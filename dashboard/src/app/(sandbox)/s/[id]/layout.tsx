export default function SandboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen w-full flex flex-col">{children}</div>;
}
