import '@/app/globals.css';
import Providers from '@/components/Providers';
import Navbar from '@/components/Navbar';
import SnakeBackground from '@/components/SnakeBackground';

export const metadata = {
  title: 'EEFlasher - Downloads & Firmware Database',
  description: 'Download EEFlasher, a modern USB flash and EEPROM programmer. Access the community firmware database to find and download ROM dumps for routers, receivers, and TVs.',
  icons: {
    icon: '/Assets/EEFlasher.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SnakeBackground />
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
