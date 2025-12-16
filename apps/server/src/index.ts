import "dotenv/config";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { RPCHandler } from "@orpc/server/fetch";
import { onError } from "@orpc/server";
import { createContext } from "@crossway/api/context";
import { appRouter } from "@crossway/api/routers/index";
import { auth } from "@crossway/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createServer } from "http";
import { Server } from "socket.io";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData,
} from "@crossway/socket";
import { handleSocketConnection } from "./socket/game-handler";
import { roomManager } from "./socket/room-manager";
import { rateLimiter } from "./socket/rate-limiter";

if(!process.env.SERVER_URL) {
	throw new Error("SERVER_URL is not set");
}

const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: process.env.CORS_ORIGIN || "",
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context: context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.get("/", (c) => {
	return c.text("OK");
});

app.get("/rooms/status", (c) => {
	return c.json({
		currentRooms: roomManager.getRoomCount(),
		maxRooms: roomManager.getMaxRooms(),
		canCreate: roomManager.canCreateRoom(),
	});
});

const port = parseInt(process.env.PORT || "3000", 10);

const httpServer = createServer(async (req, res) => {
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (value) {
			if (Array.isArray(value)) {
				value.forEach((v) => headers.append(key, v));
			} else {
				headers.set(key, value);
			}
		}
	}

	const response = await app.fetch(
		new Request(`${process.env.SERVER_URL}${req.url}`, {
			method: req.method,
			headers,
			body: req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
			duplex: "half",
		} as RequestInit)
	);

	res.statusCode = response.status;
	response.headers.forEach((value, key) => {
		res.setHeader(key, value);
	});

	if (response.body) {
		const reader = response.body.getReader();
		const pump = async () => {
			const { done, value } = await reader.read();
			if (done) {
				res.end();
				return;
			}
			res.write(value);
			await pump();
		};
		await pump();
	} else {
		res.end();
	}
});

const io = new Server<
	ClientToServerEvents,
	ServerToClientEvents,
	InterServerEvents,
	SocketData
>(httpServer, {
	cors: {
		origin: process.env.CORS_ORIGIN || "",
		methods: ["GET", "POST"],
		credentials: true,
	},
});

io.on("connection", (socket) => {
	const forwarded = socket.handshake.headers["x-forwarded-for"];
	const ip = typeof forwarded === "string"
		? forwarded.split(",")[0]?.trim() ?? socket.handshake.address
		: socket.handshake.address;

	const connectionCheck = rateLimiter.addConnection(ip, socket.id);
	if (!connectionCheck.allowed) {
		socket.emit("room:error", {
			code: "RATE_LIMIT_CONNECTIONS",
			message: connectionCheck.error ?? "Too many connections",
		});
		socket.disconnect(true);
		return;
	}

	socket.data.clientIp = ip;

	socket.on("disconnect", () => {
		rateLimiter.removeConnection(ip, socket.id);
	});

	handleSocketConnection(io, socket);
});

setInterval(() => {
	const cleaned = roomManager.cleanupStaleRooms();
	if (cleaned > 0) {
		console.log(`Cleaned up ${cleaned} stale rooms`);
	}
}, 60000);

httpServer.listen(port, () => {
	console.log(`Server running on port ${port}`);
	console.log(`Max rooms: ${roomManager.getMaxRooms()}`);
});
