# EEFlasher - Modern USB Flash/EEPROM Programmer

<div align="center">

**A modern, cross-platform replacement for AsProgrammer**

[![.NET 10](https://img.shields.io/badge/.NET-10.0-512BD4)](https://dotnet.microsoft.com/)
[![Avalonia UI](https://img.shields.io/badge/Avalonia-12.0-purple)](https://avaloniaui.net/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

## 🚀 Features

- ✅ **Modern Dark UI** - Clean, professional interface built with Avalonia
- ✅ **CH341A & CH347 Support** - Full support for both USB programmers (32-bit & 64-bit)
- ✅ **Reliable Chip Detection** - 3x retry logic with smart error handling
- ✅ **SPI Flash** - Read, Write, Verify, Erase, Blank Check for 25-series chips
- ✅ **Write Protection Unlock** - Disable chip protection to enable erasing/writing
- ✅ **Auto-Detection** - Automatic chip and programmer identification
- ✅ **40+ Chips** - Winbond, Macronix, GigaDevice, Micron, and more
- ✅ **Hex Editor** - Built-in hex viewer/editor with syntax highlighting
- ✅ **Progress Tracking** - Real-time progress bars and detailed logging
- ✅ **Cross-Platform** - Windows 32-bit & 64-bit (Linux/macOS planned)

## 📋 Supported Hardware

| Device | Status | Protocols | 32-bit | 64-bit |
|--------|--------|-----------|--------|--------|
| **CH341A** | ✅ Working | SPI, I2C | ✅ | ✅ |
| **CH347** | ✅ Working | SPI, I2C | ✅ | ✅ |
| USBAsp | ⚠️ Partial | SPI | ✅ | ✅ |
| AVRISP | 🔄 Planned | SPI, ISP | - | - |
| Bus Pirate | 🔄 Planned | SPI, I2C | - | - |
| FT232H | 🔄 Planned | SPI, I2C | - | - |
| Arduino | 🔄 Planned | SPI | - | - |

## 📦 Supported Chips

### SPI Flash (25-series)
- **Winbond**: W25Q10, W25Q20, W25Q40, W25Q80, W25Q16, W25Q32JV/BV/FV, W25Q64JV/BV/CV/FV, W25Q128JV/BV/FV, W25Q256JV/FV
- **Macronix**: MX25L1005, MX25L2005, MX25L4005, MX25L8005, MX25L1606E, MX25L3206E, MX25L6405D, MX25L12805D
- **GigaDevice**: GD25Q40, GD25Q80, GD25Q16, GD25Q32, GD25Q64, GD25Q128
- **Micron**: M25P80, M25P16

### I2C EEPROM (24-series)
- **Atmel**: AT24C256, AT24C512
- **Microchip**: 24LC256

### MicroWire
- **Atmel**: AT93C46, AT93C56, AT93C66

*More chips being added regularly*

## 🛠️ Installation

### Prerequisites
- Windows 10/11 (32-bit or 64-bit)
- **For Self-Contained Build**: No runtime required! Just run the .exe
- **For Development**: .NET 10 SDK
- CH341A/CH347 drivers (for CH341A/CH347 devices)

### Quick Start

1. **Download EEFlasher**
   ```bash
   git clone https://github.com/yourusername/EEFlasher.git
   cd EEFlasher/EEFlasher
   ```

2. **Build (Self-Contained - Recommended)**
   
   **Easy Way - Full Build (x64 + x86):**
   ```bash
   build.bat
   ```
   
   **Quick Build (x64 only):**
   ```bash
   build-simple.bat
   ```
   
   This creates a **single executable** with .NET 10 bundled - no installation required!
   - Output: `publish/x64/EEFlasher.exe` (~50 MB)
   - Includes all hardware DLLs
   - Works on any Windows 10/11 PC without .NET
   
   **Manual Build:**
   ```bash
   # x64 self-contained
   dotnet publish -c Release -r win-x64 /p:Platform=x64 --self-contained true /p:PublishSingleFile=true
   copy Assets\Hardware\x64\*.dll bin\x64\Release\net10.0\win-x64\publish\
   
   # x86 self-contained
   dotnet publish -c Release -r win-x86 /p:Platform=x86 --self-contained true /p:PublishSingleFile=true
   copy Assets\Hardware\x86\*.dll bin\x86\Release\net10.0\win-x86\publish\
   ```

3. **Run**
   - **Self-contained**: `publish\x64\EEFlasher.exe` (no .NET required!)
   - **Development**: `dotnet run` (requires .NET 10 SDK)

### Hardware Setup

#### CH341A / CH347 Drivers

1. **Install Drivers**
   - **CH341A**: Run `../Asprogrammer/drivers/CH34X/CH341SER.EXE`
   - **CH347**: Run `../Asprogrammer/drivers/CH34X/CH343SER.EXE`
   - **CH347**: Run `AsProgrammer/drivers/CH34X/CH343SER.EXE`
   - Restart your computer

2. **Verify Installation**
   - Connect device
   - Open Device Manager → Look for "USB-SERIAL CH340" (CH341A) or "USB-SERIAL CH343" (CH347)

3. **DLLs (Already Included)**
   - Platform-specific DLLs are automatically copied during build
   - **64-bit**: `CH341DLLA64.DLL`, `CH347DLLA64.DLL`
   - **32-bit**: `CH341DLL.DLL`, `CH347DLL.DLL`
   - Located in `Assets/Hardware/{platform}/`, copied to output directory

**See [HARDWARE_DLLS.md](HARDWARE_DLLS.md) for detailed DLL documentation.**

## 📖 Usage

### Basic Workflow

1. **Connect Device**
   - Select hardware from dropdown (CH341A, CH347, USBAsp)
   - Click "Connect" button (or wait for auto-detection)
   - Check log for connection status

2. **Detect Chip**
   - Insert chip into programmer
   - Click "Read ID" button
   - Chip will be auto-detected and selected

3. **Read Chip**
   - Click "Read" button
   - Wait for progress to complete
   - Data is loaded into hex editor

4. **Write Chip**
   - Load data (read from another chip or open file)
   - Click "Write" button
   - Wait for completion

5. **Verify**
   - Click "Verify" to compare chip with buffer
   - Check log for any mismatches

### Operations

| Operation | Description | Shortcut |
|-----------|-------------|----------|
| **Connect** | Connect to USB programmer | - |
| **Read ID** | Auto-detect chip via JEDEC ID | - |
| **Read** | Read entire chip to buffer | - |
| **Write** | Write buffer to chip | - |
| **Verify** | Compare chip with buffer | - |
| **Erase** | Erase entire chip (fill with 0xFF) | - |
| **Blank Check** | Verify chip is erased | - |
| **Unlock** | Disable write protection | - |

### 🔓 Write Protection Unlock

Many flash chips have write protection enabled by default or after being programmed. If you encounter errors when trying to erase or write, use the **Unlock** feature:

1. **Connect** to your programmer
2. **Detect** the chip (optional, but recommended)
3. Click the **Unlock** button (gold lock icon)
4. Check the log for status register values
5. Proceed with erase/write operations

The unlock feature:
- ✅ Works with all SPI25 series chips (Winbond, Macronix, GigaDevice, etc.)
- ✅ Supports SPI45 series (Atmel DataFlash)
- ✅ Handles SST chips with special requirements
- ✅ Shows detailed status register information
- ✅ Based on proven AsProgrammer implementation

**See [UNLOCK_FEATURE.md](UNLOCK_FEATURE.md) for detailed documentation.**

**Common scenarios:**
- Chip was previously programmed and locked
- Status register protection bits are set
- Getting "write failed" or "erase failed" errors
- Chip appears read-only

## 🎨 Hex Editor

The built-in hex editor provides:
- **Hex View** - Traditional hex dump format
- **ASCII View** - Side-by-side ASCII representation
- **Editing** - Click to edit bytes (with warning)
- **Modified Highlighting** - Orange color for changed bytes
- **Keyboard Shortcuts**:
  - `Ctrl+C` - Copy selection
  - `Ctrl+V` - Paste
  - `Ctrl+F` - Find
  - `Ctrl+G` - Go to address
  - `Ctrl+Z` - Undo
  - `Ctrl+Y` - Redo

## 🔧 Configuration

### Chip Database
Chips are defined in `Assets/ChipDatabase/chips.json`:

```json
{
  "manufacturer": "Winbond",
  "model": "W25Q32JV",
  "id": "EF4016",
  "pageSize": 256,
  "size": 4194304,
  "spiCommand": "SPI25",
  "protocol": "SPI"
}
```

### Adding Custom Chips
1. Edit `Assets/ChipDatabase/chips.json`
2. Add your chip definition
3. Rebuild application

## 🐛 Troubleshooting

### "DLL not found" (CH341DLLA64.DLL, CH347DLLA64.DLL, etc.)
- **Solution**: Rebuild project with correct platform
  - 64-bit: `dotnet build /p:Platform=x64`
  - 32-bit: `dotnet build /p:Platform=x86`
- **Manual**: Copy DLLs from `Assets/Hardware/{platform}/` to output directory
- **Check**: Verify you're running the correct build for your Windows version

### "Device not found" (CH341A, CH347, etc.)
- Check USB connection
- Verify drivers installed (Device Manager)
- Close other programmer software (AsProgrammer, NeoProgrammer)
- Try different USB port
- For CH347: Ensure you have the latest CH343 drivers installed

### "Chip not detected"
- Ensure chip is properly inserted
- Check chip orientation (pin 1 marker)
- Try cleaning chip pins
- Verify chip is not damaged

### Read/Write too fast (not working)
- This was fixed in latest version
- Ensure you're using CH341DLLA64.DLL (64-bit)
- Check that SPI operations use combined write-read

## 📊 Project Structure

```
EEFlasher/
├── Core/
│   ├── Hardware/          # Device drivers
│   │   ├── CH341/         # CH341 P/Invoke wrapper
│   │   ├── CH347/         # CH347 P/Invoke wrapper
│   │   ├── LibUsb/        # LibUSB wrapper
│   │   └── *.cs           # Device implementations
│   ├── Protocols/         # SPI, I2C, MicroWire protocols
│   ├── Models/            # Data models (ChipInfo, MemoryId)
│   └── Services/          # Chip database service
├── ViewModels/            # MVVM view models
├── Views/                 # Avalonia UI views
├── Assets/
│   ├── ChipDatabase/      # chips.json
│   └── Hardware/          # Platform-specific DLLs
│       ├── x64/           # 64-bit DLLs (CH341DLLA64.DLL, CH347DLLA64.DLL)
│       └── x86/           # 32-bit DLLs (CH341DLL.DLL, CH347DLL.DLL)
├── build.bat              # Build script for both platforms
└── HARDWARE_DLLS.md       # DLL documentation

```

## 🤝 Contributing

Contributions are welcome! Areas needing help:
- Additional hardware support (Bus Pirate, FT232H, etc.)
- More chip definitions
- Linux/macOS support
- I2C EEPROM implementation
- MicroWire implementation
- Hex editor enhancements
- File format support (BIN, HEX, S19)

## 📝 Comparison with AsProgrammer

| Feature | AsProgrammer | EEFlasher |
|---------|-------------|-----------|
| UI Framework | Lazarus/FPC | Avalonia/.NET |
| Platform | Windows only | Cross-platform |
| Architecture | 32-bit only | 32-bit & 64-bit |
| UI Theme | Light only | Dark (modern) |
| Chip Database | XML | JSON |
| Settings Storage | INI files | SQLite |
| Code Language | Pascal | C# |
| Hex Editor | Basic | Advanced (planned) |
| Auto-detect | ✅ | ✅ |
| CH341A Support | ✅ | ✅ |
| CH347 Support | ❌ | ✅ |
| Active Development | Slow | Active |

## 🙏 Credits

- **AsProgrammer** - Original inspiration and reference implementation
- **WCH** - CH341A and CH347 hardware and drivers
- **Avalonia** - Cross-platform UI framework
- **.NET Team** - Runtime and tooling

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Links

- **AsProgrammer**: https://github.com/nofeletru/UsbAsp-flash
- **CH341 Drivers**: http://www.wch.cn/downloads/CH341SER_EXE.html
- **Avalonia UI**: https://avaloniaui.net/
- **.NET**: https://dotnet.microsoft.com/

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/EEFlasher/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/EEFlasher/discussions)

---

**Made with ❤️ for the hardware hacking community**
