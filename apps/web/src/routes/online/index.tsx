import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function OnlineLobbyComponent() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");

  function handleCreateRoom() {
    const code = generateRoomCode();
    navigate({ to: `/play/crossway/online/${code}` });
  }

  function handleJoinRoom() {
    if (roomCode.length === 6) {
      navigate({ to: `/play/crossway/online/${roomCode.toUpperCase()}` });
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center gap-8">
      <Link to="/games/crossway">
        <Button variant="ghost" size="sm">
          ← Back to Crossway
        </Button>
      </Link>

      <h1 className="text-2xl font-bold text-foreground">
        Crossway - Online PvP
      </h1>

      <div className="flex flex-col gap-6 w-full max-w-md">
        <div className="p-6 bg-card border border-border rounded-lg space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Create Room</h2>
          <p className="text-sm text-muted-foreground">
            Create a new room and share the code with your friend
          </p>
          <Button onClick={handleCreateRoom} className="w-full">
            Create New Room
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="p-6 bg-card border border-border rounded-lg space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Join Room</h2>
          <p className="text-sm text-muted-foreground">
            Enter a room code to join an existing game
          </p>
          <div className="space-y-2">
            <Label htmlFor="roomCode">Room Code</Label>
            <Input
              id="roomCode"
              placeholder="Enter 6-character code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="font-mono uppercase text-center text-lg tracking-widest"
            />
          </div>
          <Button
            onClick={handleJoinRoom}
            disabled={roomCode.length !== 6}
            className="w-full"
            variant="secondary"
          >
            Join Room
          </Button>
        </div>
      </div>
    </div>
  );
}
