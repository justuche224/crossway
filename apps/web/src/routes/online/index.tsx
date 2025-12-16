import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Lock, LockOpen } from "lucide-react";

export const Route = createFileRoute("/online/")({
  component: OnlineLobbyComponent,
});

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface RoomStatus {
  currentRooms: number;
  maxRooms: number;
  canCreate: boolean;
}

function OnlineLobbyComponent() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);

  useEffect(() => {
    const serverUrl =
      import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
    fetch(`${serverUrl}/rooms/status`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setRoomStatus(data))
      .catch(() => {});
  }, []);

  async function handleCreateRoom() {
    if (roomStatus && !roomStatus.canCreate) {
      toast.error("Server is at capacity. Please try again later.");
      return;
    }

    setIsCreating(true);
    const code = generateRoomCode();

    if (roomPassword) {
      navigate({
        to: `/online/${code}`,
        search: { password: roomPassword },
      });
    } else {
      navigate({ to: `/online/${code}` });
    }
  }

  function handleJoinRoom() {
    if (roomCode.length === 6) {
      navigate({ to: `/online/${roomCode.toUpperCase()}` });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-sm font-medium text-foreground">Online PvP</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-medium mb-3">
            Multiplayer
          </p>
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Play Online
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Create a room and invite a friend, or join an existing game with a
            room code.
          </p>
        </div>

        {roomStatus && (
          <div className="max-w-sm mx-auto mb-8 text-center">
            <p className="text-xs text-muted-foreground">
              Active rooms: {roomStatus.currentRooms} / {roomStatus.maxRooms}
            </p>
          </div>
        )}

        <div className="max-w-sm mx-auto space-y-12">
          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4">
              Create Room
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Start a new game and share the code with your friend.
            </p>

            <button
              type="button"
              onClick={() => setShowPasswordField(!showPasswordField)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              {showPasswordField ? (
                <Lock className="w-4 h-4" />
              ) : (
                <LockOpen className="w-4 h-4" />
              )}
              <span>
                {showPasswordField
                  ? "Password protected"
                  : "Add password (optional)"}
              </span>
            </button>

            {showPasswordField && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Room password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full py-3 px-4 bg-transparent border border-border focus:border-foreground outline-none text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors rounded"
                />
              </div>
            )}

            <button
              onClick={handleCreateRoom}
              disabled={
                isCreating || Boolean(roomStatus && !roomStatus.canCreate)
              }
              className="w-full group flex items-center justify-center gap-3 py-4 bg-foreground text-background font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  {roomPassword && <Lock className="w-4 h-4" />}
                  <span>Create New Room</span>
                  <span className="group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </>
              )}
            </button>
            {roomStatus && !roomStatus.canCreate && (
              <p className="text-xs text-red-500 mt-2 text-center">
                Server at capacity. Please try again later.
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4">
              Join Room
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your friend's room code to join their game.
            </p>

            <div className="mb-4">
              <label htmlFor="roomCode" className="sr-only">
                Room Code
              </label>
              <input
                id="roomCode"
                type="text"
                placeholder="XXXXXX"
                value={roomCode}
                onChange={(e) =>
                  setRoomCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                  )
                }
                maxLength={6}
                className="w-full py-4 px-4 bg-transparent border-b-2 border-border focus:border-foreground outline-none font-mono text-2xl text-center tracking-[0.5em] text-foreground placeholder:text-muted-foreground/30 transition-colors"
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={roomCode.length !== 6}
              className="w-full group flex items-center justify-center gap-3 py-4 border-2 border-foreground text-foreground font-semibold hover:bg-foreground hover:text-background disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-foreground transition-all"
            >
              <span>Join Room</span>
              <span className="group-hover:translate-x-1 transition-transform">
                →
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
