export default function EditorLayout({ children }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg)]">
      {children}
    </div>
  );
}
