import './globals.css';

export const metadata = {
    title: 'Neon Drive - Minimalist Racer',
    description: 'Neon Drive – A minimalist neon-themed racing game with drift mechanics, nitro boost, and an open city to explore.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body suppressHydrationWarning>{children}</body>
        </html>
    );
}
