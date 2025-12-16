import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: CrosswayLandingComponent,
});

function CrosswayLandingComponent() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">Crossway</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A strategic board game where two players race to move their pieces
            from one side of the board to the other.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/solo" className="block">
            <div className="p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors h-full">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                <div className="w-6 h-6 rounded-full bg-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                VS Computer
              </h3>
              <p className="text-sm text-muted-foreground">
                Practice against AI with Easy or Hard difficulty
              </p>
            </div>
          </Link>

          <Link to="/local" className="block">
            <div className="p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors h-full">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Local PvP
              </h3>
              <p className="text-sm text-muted-foreground">
                Play against a friend on the same device
              </p>
            </div>
          </Link>

          <Link to="/online" className="block">
            <div className="p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors h-full">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <div className="w-6 h-6 rounded-full bg-purple-500" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Online PvP
              </h3>
              <p className="text-sm text-muted-foreground">
                Create a room and play with friends online
              </p>
            </div>
          </Link>
        </div>

        <div className="p-6 bg-card border border-border rounded-lg">
          <h2 className="text-xl font-bold text-foreground mb-4">How to Play</h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h3 className="font-semibold text-foreground mb-1">Objective</h3>
              <p>
                Move all 3 of your pieces from your starting side to the
                opponent's home positions. Blue starts on the left and aims for
                the right. Red starts on the right and aims for the left.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Movement</h3>
              <p>
                Pieces move one position at a time along the connected paths.
                You cannot jump over or pass through positions occupied by any
                piece.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Rules</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Blue always moves first</li>
                <li>You must make a move on your turn</li>
                <li>No jumping over pieces</li>
                <li>First player to get all pieces to opponent's home wins</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="p-6 bg-card border border-border rounded-lg">
          <h2 className="text-xl font-bold text-foreground mb-4">Leaderboard</h2>
          <p className="text-sm text-muted-foreground italic">
            Coming soon - compete for the top spots!
          </p>
        </div>
      </div>
    </div>
  );
}
