interface TopBarProps {
  username: string;
  onLogout: () => void;
}

const TopBar = ({ username, onLogout }: TopBarProps) => (
  <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/80 px-8 py-4 backdrop-blur-xl">
    <h1 className="font-display text-xl font-extrabold tracking-tight text-gradient">IT LITES</h1>
    <div className="flex items-center gap-4">
      <div className="rounded-full border border-border bg-card px-4 py-1.5 text-[0.82rem] text-muted-foreground">
        Logged in as — <span className="font-medium text-foreground">{username}</span>
      </div>
      <button
        onClick={onLogout}
        className="rounded-lg border border-border px-3 py-1.5 text-[0.8rem] text-muted-foreground transition-all hover:border-warn hover:text-warn"
      >
        Logout
      </button>
    </div>
  </div>
);

export default TopBar;
