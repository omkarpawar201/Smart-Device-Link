# rfcomm-bridge.ps1
# Windows-side raw RFCOMM client for the DIY Phone Link custom-UUID service.
#
# Node.js has no built-in Bluetooth API, and .NET Framework (which PowerShell
# 5.1 runs on) never shipped the BCL Bluetooth types either — AddressFamily.
# Bluetooth / BluetoothEndPoint are .NET Core only. So this helper talks
# directly to Winsock via P/Invoke:
#   socket(AF_BTH=32, SOCK_STREAM=1, BTHPROTO_RFCOMM=3)
#   connect() against SOCKADDR_BTH with port = BT_PORT_ANY, which makes the
#   Windows Bluetooth stack resolve the RFCOMM channel through an SDP query
#   of the service GUID automatically.
#
# This deliberately does NOT use Windows virtual COM ports (those are only
# mapped for the SPP service) and does NOT rely on HFP or any native
# call-audio profile, mirroring how Microsoft Phone Link works.
#
# Usage:
#   powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass `
#     -File rfcomm-bridge.ps1 -Mac AABBCCDDEEFF -Guid <service-uuid>
#
# Contract:
#   * stdout = raw relay bytes (phone -> Node)
#   * stdin  = raw relay bytes (Node -> phone)
#   * stderr = human diagnostics prefixed with [STATUS] markers
#
# Exit codes: 0 = clean close, 2 = connect failed, 3 = relay error

param(
    [Parameter(Mandatory = $true)][string]$Mac,
    [Parameter(Mandatory = $true)][string]$Guid
)

$ErrorActionPreference = 'Stop'

# Normalize MAC to a bare 12-hex-digit form.
$rawMac = ($Mac -replace '[^0-9a-fA-F]', '').ToUpperInvariant()
if ($rawMac.Length -ne 12) {
    [Console]::Error.WriteLine('[STATUS] ERROR_INVALID_MAC')
    exit 1
}

Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class RfcommRelay
{
    private const int AF_BTH = 32;
    private const int SOCK_STREAM = 1;
    private const int BTHPROTO_RFCOMM = 3;
    private const uint BT_PORT_ANY = 0;
    private const int SD_SEND = 1;

    // Matches the Windows SDK _SOCKADDR_BTH layout, which is declared under
    // pshpack1 (packed): addressFamily @0 (2), btAddr @2 (8), serviceClassId
    // @10 (16), port @26 (4). Total 30 bytes. Passing the aligned 36/40-byte
    // variant makes the stack misread btAddr and return WSAEADDRNOTAVAIL.
    [StructLayout(LayoutKind.Explicit, Pack = 1)]
    private struct SOCKADDR_BTH
    {
        [FieldOffset(0)] public ushort addressFamily;
        [FieldOffset(2)] public ulong btAddr;
        [FieldOffset(10)] public Guid serviceClassId;
        [FieldOffset(26)] public uint port;
    }

    [DllImport("ws2_32.dll")]
    private static extern int WSAStartup(ushort wVersionRequested, [Out] byte[] lpWSAData);

    [DllImport("ws2_32.dll")]
    private static extern IntPtr socket(int af, int type, int protocol);

    [DllImport("ws2_32.dll", SetLastError = true)]
    private static extern int connect(IntPtr s, ref SOCKADDR_BTH name, int namelen);

    [DllImport("ws2_32.dll", SetLastError = true)]
    private static extern int send(IntPtr s, byte[] buf, int len, int flags);

    [DllImport("ws2_32.dll", SetLastError = true)]
    private static extern int recv(IntPtr s, [Out] byte[] buf, int len, int flags);

    [DllImport("ws2_32.dll")]
    private static extern int shutdown(IntPtr s, int how);

    [DllImport("ws2_32.dll")]
    private static extern int closesocket(IntPtr s);

    [DllImport("ws2_32.dll")]
    private static extern int WSAGetLastError();

    // BTH_ADDR is a 64-bit value holding the 48-bit MAC, LSB first: the first
    // octet of the MAC is the least significant byte.
    private static ulong MacToBthAddr(string mac)
    {
        ulong value = 0;
        for (int i = 0; i < 6; i++)
        {
            byte b = Convert.ToByte(mac.Substring(i * 2, 2), 16);
            value |= ((ulong)b) << (i * 8);
        }
        return value;
    }

    private static string WinsockError(int code)
    {
        switch (code)
        {
            case 10049: return "WSAEADDRNOTAVAIL (unrecognised MAC)";
            case 10051: return "WSAENETUNREACH (device unreachable / not paired)";
            case 10060: return "WSAETIMEDOUT (no response)";
            case 10061: return "WSAECONNREFUSED (service GUID not in device SDP)";
            default: return "Winsock error " + code;
        }
    }

    private static int SendAll(IntPtr s, byte[] buf, int len)
    {
        int offset = 0;
        while (offset < len)
        {
            int chunk = len - offset;
            byte[] slice = new byte[chunk];
            Array.Copy(buf, offset, slice, 0, chunk);
            int sent = send(s, slice, chunk, 0);
            if (sent <= 0) return -1;
            offset += sent;
        }
        return 0;
    }

    public static int Run(string mac, string guid)
    {
        // .NET only calls WSAStartup lazily when a *managed* socket API is used.
        // Since we P/Invoke ws2_32 directly, initialize Winsock explicitly or
        // socket(AF_BTH) fails with WSAGetLastError() == 2.
        byte[] wsadata = new byte[512];
        if (WSAStartup(0x0202, wsadata) != 0)
        {
            Console.Error.WriteLine("[STATUS] ERROR_CONNECT: WSAStartup failed (" + WSAGetLastError() + ")");
            return 2;
        }

        IntPtr s = socket(AF_BTH, SOCK_STREAM, BTHPROTO_RFCOMM);
        if ((long)s == -1)
        {
            Console.Error.WriteLine("[STATUS] ERROR_CONNECT: socket() failed (" + WSAGetLastError() + ")");
            return 2;
        }

        SOCKADDR_BTH addr = new SOCKADDR_BTH();
        addr.addressFamily = AF_BTH;
        addr.btAddr = MacToBthAddr(mac);
        addr.serviceClassId = new Guid(guid);
        addr.port = BT_PORT_ANY;

        try
        {
            Console.Error.WriteLine("[STATUS] CONNECTING");
            int rc = connect(s, ref addr, Marshal.SizeOf(typeof(SOCKADDR_BTH)));
            if (rc != 0)
            {
                int err = WSAGetLastError();
                Console.Error.WriteLine("[STATUS] ERROR_CONNECT: " + WinsockError(err));
                return 2;
            }
            Console.Error.WriteLine("[STATUS] CONNECTED");
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[STATUS] ERROR_CONNECT: " + ex.Message);
            return 2;
        }

        try
        {
            Stream stdin = new FileStream(new SafeFileHandle(GetStdHandle(-10), false), FileAccess.Read);
            Stream stdout = new FileStream(new SafeFileHandle(GetStdHandle(-11), false), FileAccess.Write);

            // stdin -> phone
            Thread up = new Thread(delegate()
            {
                byte[] b = new byte[8192];
                int n;
                while ((n = stdin.Read(b, 0, b.Length)) > 0)
                {
                    if (SendAll(s, b, n) != 0) break;
                }
                try { shutdown(s, SD_SEND); } catch { }
            });
            up.IsBackground = true;
            up.Start();

            // phone -> stdout
            byte[] buf = new byte[8192];
            int r;
            while ((r = recv(s, buf, buf.Length, 0)) > 0)
            {
                stdout.Write(buf, 0, r);
                stdout.Flush();
            }

            up.Join(2000);
            Console.Error.WriteLine("[STATUS] CLOSED");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[STATUS] ERROR: " + ex.Message);
            return 3;
        }
        finally
        {
            try { closesocket(s); } catch { }
        }
    }

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetStdHandle(int nStdHandle);
}
'@

try {
    $code = [RfcommRelay]::Run($rawMac, $Guid)
    exit $code
}
catch {
    [Console]::Error.WriteLine("[STATUS] ERROR: " + $_.Exception.Message)
    exit 3
}
