import Link from "next/link";

export default function Navbar() {
    return (
        <header className="bg-gray-100 shadow-sm container mx-auto p-4 flex items-center justify-between rounded">
            <Link href="/" className="text-xl font-bold">Warnetku</Link>
            <nav className="space-x-4">
              <Link href="/" className="text-sm">Home</Link>
              <Link href="/komputer" className="text-sm">Komputer</Link>
              <Link href="/admin/users" className="text-sm">User</Link>
              <Link href="/admin" className="text-sm">Atmint</Link>
            </nav>
        </header>
    )
}