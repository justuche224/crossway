import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: CrosswayLandingComponent,
});

function CrosswayLandingComponent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="pt-16 pb-12 px-6 text-center border-b border-border">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-medium mb-4">
            Strategic Board Game
          </p>
          <h1 className="text-6xl md:text-8xl font-black text-foreground tracking-tight mb-6">
            Crossway
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Two players. Three pieces each. One path to victory.
            <br />
            <span className="text-foreground font-medium">
              Race across the board.
            </span>
          </p>
        </div>
      </header>

      {/* Game Modes */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-medium mb-10 text-center">
            Choose Your Battle
          </h2>

          <div className="space-y-4">
            {/* VS Computer */}
            <Link to="/solo" className="group block">
              <div className="flex items-center gap-6 py-6 px-2 border-b border-border hover:border-foreground/30 transition-colors">
                <div className="w-14 h-14 rounded-full border-2 border-foreground/20 flex items-center justify-center group-hover:border-foreground/50 transition-colors">
                  <div className="w-5 h-5 rounded-full bg-foreground/80" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                    VS Computer
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Practice against AI • Easy or Hard difficulty
                  </p>
                </div>
                <span className="text-3xl text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-2 transition-all">
                  →
                </span>
              </div>
            </Link>

            {/* Local PvP */}
            <Link to="/local" className="group block">
              <div className="flex items-center gap-6 py-6 px-2 border-b border-border hover:border-foreground/30 transition-colors">
                <div className="w-14 h-14 rounded-full border-2 border-foreground/20 flex items-center justify-center group-hover:border-foreground/50 transition-colors">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-foreground/60" />
                    <div className="w-3 h-3 rounded-full bg-foreground/90" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                    Local PvP
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Same device • Take turns with a friend
                  </p>
                </div>
                <span className="text-3xl text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-2 transition-all">
                  →
                </span>
              </div>
            </Link>

            {/* Online PvP */}
            <Link to="/online" className="group block">
              <div className="flex items-center gap-6 py-6 px-2 border-b border-border hover:border-foreground/30 transition-colors">
                <div className="w-14 h-14 rounded-full border-2 border-foreground/20 flex items-center justify-center group-hover:border-foreground/50 transition-colors">
                  <div className="relative">
                    <div className="w-4 h-4 rounded-full bg-foreground/80" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                    Online PvP
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Create rooms • Play with friends anywhere
                  </p>
                </div>
                <span className="text-3xl text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-2 transition-all">
                  →
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* How to Play */}
      <section className="py-16 px-6 bg-secondary/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-medium mb-12 text-center">
            How to Play
          </h2>

          <div className="grid md:grid-cols-3 gap-12 md:gap-8">
            {/* Objective */}
            <div className="text-center md:text-left">
              <div className="text-5xl font-black text-foreground/10 mb-3">
                01
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Objective
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Move all 3 pieces from your starting side to the opponent's
                home. Blue aims right, Red aims left.
              </p>
            </div>

            {/* Movement */}
            <div className="text-center md:text-left">
              <div className="text-5xl font-black text-foreground/10 mb-3">
                02
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Movement
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pieces move one position at a time along connected paths. No
                jumping over occupied positions.
              </p>
            </div>

            {/* Victory */}
            <div className="text-center md:text-left">
              <div className="text-5xl font-black text-foreground/10 mb-3">
                03
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                Victory
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                First player to get all three pieces to the opponent's home
                positions wins. Blue always moves first.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Rules */}
      <section className="py-12 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">•</span> Blue moves
              first
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">•</span> Must move
              on your turn
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">•</span> No jumping
              pieces
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">•</span> Block your
              opponent
            </span>
          </div>
        </div>
      </section>

      {/* Leaderboard Teaser */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-border bg-secondary/50">
            <span className="text-xl">🏆</span>
            <span className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Leaderboard</span> —
              Coming Soon
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-muted-foreground/60">
            Crossway — A game of strategy and positioning
          </p>
        </div>
      </footer>
    </div>
  );
}
