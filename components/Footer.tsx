export default function Footer() {
  return (
    <footer className="border-t border-canopy-border py-10 text-center text-sm text-canopy-muted">
      <p>Canopy Market — for adults 21+. Cannabis laws vary by state; check local regulations.</p>
      <p className="mt-1">Product and pricing information is provided by listed dispensaries. Order directly with the dispensary to complete a purchase.</p>
      <p className="mt-4">© {new Date().getFullYear()} Canopy Market</p>
    </footer>
  );
}
