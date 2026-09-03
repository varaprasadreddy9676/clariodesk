export function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        <span>{subtitle}</span>
      </div>
    </header>
  );
}
