# EEFlasher - Modern USB Flash/EEPROM Programmer

<div align="center">

**A modern, cross-platform replacement for AsProgrammer**

[![.NET 10](https://img.shields.io/badge/.NET-10.0-512BD4)](https://dotnet.microsoft.com/)
[![Avalonia UI](https://img.shields.io/badge/Avalonia-12.0-purple)](https://avaloniaui.net/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

## 🚀 Features

- ✅ **Modern Dark UI** - Clean, professional interface built with Avalonia
- ✅ **Multi-Hardware Support** - CH341A, CH347, Arduino, AVRISP, USBAsp (32-bit & 64-bit)
- ✅ **Blazing Fast Performance** - Optimized write speeds (~56 seconds for 4MB, matching commercial tools)
- ✅ **Cancellable Operations** - Stop any operation instantly with the Stop button
- ✅ **Multiple Protocols** - SPI25, SPI45 (AT45 DataFlash), I2C, and Microwire support
- ✅ **Reliable Chip Detection** - 3x retry logic with smart error handling
- ✅ **Write Protection Management** - Easy unlock/lock with detailed status register display
- ✅ **UEFI Capsule Parser** - Analyze and extract UEFI firmware structures
- ✅ **Advanced Hex Editor** - Built-in editor with undo/redo, search, and modification tracking
- ✅ **Comprehensive Chip Database** - 760+ chips from major manufacturers
- ✅ **Real-time Progress** - Live progress bars and detailed activity logging
- ✅ **Production Ready** - Stable, tested, and optimized for daily use

## 📋 Supported Hardware

| Device | Status | Protocols | Speed | 32-bit | 64-bit |
|--------|--------|-----------|-------|--------|--------|
| **CH341A** | ✅ Fully Supported | SPI, I2C, Microwire | Fast | ✅ | ✅ |
| **CH347** | ✅ Fully Supported | SPI, I2C, Microwire | Very Fast | ✅ | ✅ |
| **Arduino** | ✅ Supported | SPI | Medium | ✅ | ✅ |
| **AVRISP MKII** | ✅ Supported | SPI, ISP | Medium | ✅ | ✅ |
| **USBAsp** | ✅ Supported | SPI | Fast | ✅ | ✅ |
| Bus Pirate | 🔄 Planned | SPI, I2C | - | - | - |
| FT232H | 🔄 Planned | SPI, I2C | - | - | - |

### Hardware Features
- **Auto-Detection** - Automatically detects connected programmer
- **Hot-Plug Support** - Connect/disconnect without restarting
- **Multi-Device** - Switch between different programmers easily
- **Driver Included** - All necessary drivers bundled in the package

## 📦 Supported Chips

### SPI Flash (25-series)
- **Winbond**: W25Q10, W25Q20, W25Q40, W25Q80, W25Q16, W25Q32JV/BV/FV, W25Q64JV/BV/CV/FV, W25Q128JV/BV/FV, W25Q256JV/FV
- **Macronix**: MX25L1005, MX25L2005, MX25L4005, MX25L8005, MX25L1606E, MX25L3206E, MX25L6405D, MX25L12805D
- **GigaDevice**: GD25Q40, GD25Q80, GD25Q16, GD25Q32, GD25Q64, GD25Q128, GD25Q256
- **ISSI**: IS25LP064, IS25LP128, IS25WP256
- **EON**: EN25Q32, EN25Q64, EN25Q128
- **Spansion**: S25FL064, S25FL128, S25FL256
- **Micron**: M25P80, M25P16, N25Q064, N25Q128

### SPI DataFlash (45-series)
- **Atmel**: AT45DB011, AT45DB021, AT45DB041, AT45DB081, AT45DB161, AT45DB321, AT45DB642

### I2C EEPROM (24-series)
- **Atmel**: AT24C01-AT24C512
- **Microchip**: 24LC01-24LC512
- **ST**: M24C01-M24C512

### MicroWire EEPROM
- **Atmel**: AT93C46, AT93C56, AT93C66, AT93C86
- **Microchip**: 93LC46, 93LC56, 93LC66, 93LC86

### Size Range
- **Minimum**: 512 bytes (AT93C46)
- **Maximum**: 256 MB (W25Q256, GD25Q256)

*Comprehensive chip database with 760+ supported chips*

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

| Operation | Description | Cancellable | Shortcut |
|-----------|-------------|-------------|----------|
| **Connect** | Connect to USB programmer | ✅ | - |
| **Read ID** | Auto-detect chip via JEDEC ID | ✅ | - |
| **Read** | Read entire chip to buffer | ✅ | - |
| **Write** | Write buffer to chip | ✅ | - |
| **Verify** | Compare chip with buffer | ✅ | - |
| **Erase** | Erase entire chip (fill with 0xFF) | ✅ | - |
| **Blank Check** | Verify chip is erased | ✅ | - |
| **Unlock** | Disable write protection | ✅ | - |
| **Stop** | Cancel current operation | - | - |

### New Features

#### 🛑 Stop Button
- **Cancel Anytime** - Stop any running operation instantly
- **Safe Cancellation** - Proper cleanup and resource management
- **No Corruption** - Operations stop cleanly without data corruption
- **Works Everywhere** - Available for all operations (Read, Write, Verify, Erase, etc.)

#### ⚡ Performance Optimizations
- **Fast Write** - Optimized write speed (~56 seconds for 4MB chip)
- **Efficient Polling** - Smart busy-wait without delays
- **Batch Updates** - UI updates throttled for better performance
- **Reliable Read** - 256-byte chunks for maximum compatibility

#### 🔍 UEFI Capsule Support
- **Parse UEFI Capsules** - Analyze UEFI firmware update files
- **Structure View** - Tree view of capsule components
- **Extract Sections** - View individual firmware sections
- **Metadata Display** - GUID, version, and size information

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
- **Hex View** - Traditional hex dump format with 16 bytes per row
- **ASCII View** - Side-by-side ASCII representation
- **Live Editing** - Click to edit bytes directly
- **Modified Highlighting** - Orange color for changed bytes
- **Undo/Redo** - Full undo/redo support for all edits
- **Search** - Find hex patterns or ASCII text
- **Go To Address** - Jump to specific offset
- **Copy/Paste** - Standard clipboard operations
- **Large File Support** - Handles files up to 256MB efficiently
- **Keyboard Shortcuts**:
  - `Ctrl+C` - Copy selection
  - `Ctrl+V` - Paste
  - `Ctrl+F` - Find
  - `Ctrl+G` - Go to address
  - `Ctrl+Z` - Undo
  - `Ctrl+Y` - Redo
  - `Ctrl+O` - Open file
  - `Ctrl+S` - Save file

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
- For Arduino: Check COM port and baud rate
- For AVRISP/USBAsp: Install libusb drivers using Zadig

### "Chip not detected"
- Ensure chip is properly inserted
- Check chip orientation (pin 1 marker)
- Try cleaning chip pins
- Verify chip is not damaged
- Check power supply (some chips need 3.3V, others 5V)
- Try clicking "Read ID" multiple times (3x retry logic)

### "Write failed" or "Erase failed"
- **Most Common**: Chip has write protection enabled
  - **Solution**: Click the "Unlock" button before erasing/writing
  - Check activity log for status register values
- Check /WP pin on programmer (should be HIGH or floating)
- Verify chip is not hardware write-protected
- Some chips require power cycle after unlock

### Write is too slow
- **Fixed in v1.0.0** - Write speed now matches commercial tools
- Ensure you're using the latest version
- Check that you're not running in Debug mode
- Close other applications that might interfere

### Operation stuck or frozen
- **New Feature**: Click the Stop button (red square) to cancel
- All operations are now cancellable
- If Stop button doesn't work, close and restart the application

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
| Platform | Windows only | Windows (Linux/macOS planned) |
| Architecture | 32-bit only | 32-bit & 64-bit |
| UI Theme | Light only | Dark (modern) |
| Chip Database | XML | JSON |
| Code Language | Pascal | C# |
| Hex Editor | Basic | Advanced with undo/redo |
| UEFI Parser | ❌ | ✅ |
| Stop Button | ❌ | ✅ |
| Write Speed | ~5 minutes (4MB) | ~56 seconds (4MB) |
| Auto-detect | ✅ | ✅ |
| CH341A Support | ✅ | ✅ |
| CH347 Support | ✅ | ✅ |
| Arduino Support | ❌ | ✅ |
| AVRISP Support | ✅ | ✅ |
| USBAsp Support | ✅ | ✅ |
| I2C EEPROM | ✅ | ✅ |
| Microwire | ✅ | ✅ |
| SPI DataFlash | ✅ | ✅ |
| Active Development | Active | Active |

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
