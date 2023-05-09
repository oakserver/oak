/* define type of platform */
type IPlatform = {
    iPhone: RegExp;
    Blackberry: RegExp;
    Windows: RegExp;
    iPod: RegExp;
    Curl: RegExp;
    iOS: RegExp;
    Mac: RegExp;
    Android: RegExp;
    Linux: RegExp;
    Wii: RegExp;
    Electron: RegExp;
    iPad: RegExp;
    Playstation: RegExp;
    Samsung: RegExp;
    WindowsPhone: RegExp
};

/* define type of  os*/
type IOS = {
    iPhone: RegExp;
    Windows10: RegExp;
    OSXPuma: RegExp;
    OSXMountainLion: RegExp;
    Bada: RegExp;
    OSXYosemite: RegExp;
    iOS: RegExp;
    PS3: RegExp;
    WindowsPhone80: RegExp;
    MacOSMojave: RegExp;
    OSXPanther: RegExp;
    WindowsPhone81: RegExp;
    Electron: RegExp;
    WindowsXP: RegExp;
    Linux64: RegExp;
    OSXLion: RegExp;
    iPad: RegExp;
    OSXCheetah: RegExp;
    Windows81: RegExp;
    Windows2003: RegExp;
    OSXLeopard: RegExp;
    WindowsVista: RegExp;
    Windows2000: RegExp;
    OSXElCapitan: RegExp;
    Windows8: RegExp;
    Windows7: RegExp;
    PSP: RegExp;
    Curl: RegExp;
    Mac: RegExp;
    OSXSnowLeopard: RegExp;
    ChromeOS: RegExp;
    OSXMavericks: RegExp;
    Linux: RegExp;
    MacOSSierra: RegExp;
    OSXTiger: RegExp;
    Wii: RegExp;
    OSXJaguar: RegExp;
    MacOSHighSierra: RegExp;
    UnknownWindows: RegExp
}
/* define return type*/
export type ISystemAgent = {
    os: string;
    platform: string;
}

/* define agent type*/
type IAgent = {
    source?: string;
    isSamsung?: boolean;
    isBlackberry?: boolean;
    isAndroid?: boolean;
    isElectron?: boolean;
    isBada?: boolean;
    isCurl?: boolean;
    isiPhone?: boolean;
    isiPad?: boolean;
    isMac?: boolean;
    isChromeOS?: boolean;
    isLinux64?: boolean;
    isWindowsPhone?: boolean;
    isLinux?: boolean;
    isWindows?: boolean;

}

/* define  interface user agent class */
interface IUserAgent {

    detectUserAgent(): ISystemAgent;

}

/* define  class User Agent */
export class UserAgent implements IUserAgent {
    /* define  variable */
    private agent: IAgent;
    private os: IOS;
    private platform: IPlatform;
    private header: Headers;

    /* get headers */
    constructor(header: Headers) {
        /* init variable  */
        this.header = header;
        this.agent = {source: header.get('user-agent').replace(/^\s*/, '').replace(/\s*$/, '')};
        this.os = {
            Windows10: /windows nt 10\.0/i,
            Windows81: /windows nt 6\.3/i,
            Windows8: /windows nt 6\.2/i,
            Windows7: /windows nt 6\.1/i,
            UnknownWindows: /windows nt 6\.\d+/i,
            WindowsVista: /windows nt 6\.0/i,
            Windows2003: /windows nt 5\.2/i,
            WindowsXP: /windows nt 5\.1/i,
            Windows2000: /windows nt 5\.0/i,
            WindowsPhone81: /windows phone 8\.1/i,
            WindowsPhone80: /windows phone 8\.0/i,
            OSXCheetah: /os x 10[._]0/i,
            OSXPuma: /os x 10[._]1(\D|$)/i,
            OSXJaguar: /os x 10[._]2/i,
            OSXPanther: /os x 10[._]3/i,
            OSXTiger: /os x 10[._]4/i,
            OSXLeopard: /os x 10[._]5/i,
            OSXSnowLeopard: /os x 10[._]6/i,
            OSXLion: /os x 10[._]7/i,
            OSXMountainLion: /os x 10[._]8/i,
            OSXMavericks: /os x 10[._]9/i,
            OSXYosemite: /os x 10[._]10/i,
            OSXElCapitan: /os x 10[._]11/i,
            MacOSSierra: /os x 10[._]12/i,
            MacOSHighSierra: /os x 10[._]13/i,
            MacOSMojave: /os x 10[._]14/i,
            Mac: /os x/i,
            Linux: /linux/i,
            Linux64: /linux x86\_64/i,
            ChromeOS: /cros/i,
            Wii: /wii/i,
            PS3: /playstation 3/i,
            PSP: /playstation portable/i,
            iPad: /\(iPad.*os (\d+)[._](\d+)/i,
            iPhone: /\(iPhone.*os (\d+)[._](\d+)/i,
            iOS: /ios/i,
            Bada: /Bada\/(\d+)\.(\d+)/i,
            Curl: /curl\/(\d+)\.(\d+)\.(\d+)/i,
            Electron: /Electron\/(\d+)\.(\d+)\.(\d+)/i,
        };
        this.platform = {
            Windows: /windows nt/i,
            WindowsPhone: /windows phone/i,
            Mac: /macintosh/i,
            Linux: /linux/i,
            Wii: /wii/i,
            Playstation: /playstation/i,
            iPad: /ipad/i,
            iPod: /ipod/i,
            iPhone: /iphone/i,
            Android: /android/i,
            Blackberry: /blackberry/i,
            Samsung: /samsung/i,
            Curl: /curl/i,
            Electron: /Electron/i,
            iOS: /^ios\-/i
        };


    }

    /* window 11 only detect via header */
    private getOperationSystemByHeader(name: string): string {

        if (name === 'Windows 10.0' && 'windows' === this.header.get('sec-ch-ua-platform') && this.header['sec-ch-ua-platform-version'] && +this.header.get('sec-ch-ua-platform-version').split('.')[0] >= 13) {
            return 'Windows 11.0';
        }
        return name;
    };

    /* get  operating system function */
    private getOperationSystem(name: string): string {
        switch (true) {
            case this.os.WindowsVista.test(name):
                this.agent.isWindows = true;
                return 'Windows Vista';
            case this.os.Windows7.test(name):
                this.agent.isWindows = true;
                return 'Windows 7';
            case this.os.Windows8.test(name):
                this.agent.isWindows = true;
                return 'Windows 8';
            case this.os.Windows81.test(name):
                this.agent.isWindows = true;
                return 'Windows 8.1';
            case this.os.Windows10.test(name):
                this.agent.isWindows = true;
                return 'Windows 10.0';
            case this.os.Windows2003.test(name):
                this.agent.isWindows = true;
                return 'Windows 2003';
            case this.os.WindowsXP.test(name):
                this.agent.isWindows = true;
                return 'Windows XP';
            case this.os.Windows2000.test(name):
                this.agent.isWindows = true;
                return 'Windows 2000';
            case this.os.WindowsPhone81.test(name):
                this.agent.isWindowsPhone = true;
                return 'Windows Phone 8.1';
            case this.os.WindowsPhone80.test(name):
                this.agent.isWindowsPhone = true;
                return 'Windows Phone 8.0';
            case this.os.Linux64.test(name):
                this.agent.isLinux = true;
                this.agent.isLinux64 = true;
                return 'Linux 64';
            case this.os.Linux.test(name):
                this.agent.isLinux = true;
                return 'Linux';
            case this.os.ChromeOS.test(name):
                this.agent.isChromeOS = true;
                return 'Chrome OS';
            case this.os.Wii.test(name):
                return 'Wii';
            case this.os.PS3.test(name):
                return 'Playstation';
            case this.os.PSP.test(name):
                return 'Playstation';
            case this.os.OSXCheetah.test(name):
                this.agent.isMac = true;
                return 'OS X Cheetah';
            case this.os.OSXPuma.test(name):
                this.agent.isMac = true;
                return 'OS X Puma';
            case this.os.OSXJaguar.test(name):
                this.agent.isMac = true;
                return 'OS X Jaguar';
            case this.os.OSXPanther.test(name):
                this.agent.isMac = true;
                return 'OS X Panther';
            case this.os.OSXTiger.test(name):
                this.agent.isMac = true;
                return 'OS X Tiger';
            case this.os.OSXLeopard.test(name):
                this.agent.isMac = true;
                return 'OS X Leopard';
            case this.os.OSXSnowLeopard.test(name):
                this.agent.isMac = true;
                return 'OS X Snow Leopard';
            case this.os.OSXLion.test(name):
                this.agent.isMac = true;
                return 'OS X Lion';
            case this.os.OSXMountainLion.test(name):
                this.agent.isMac = true;
                return 'OS X Mountain Lion';
            case this.os.OSXMavericks.test(name):
                this.agent.isMac = true;
                return 'OS X Mavericks';
            case this.os.OSXYosemite.test(name):
                this.agent.isMac = true;
                return 'OS X Yosemite';
            case this.os.OSXElCapitan.test(name):
                this.agent.isMac = true;
                return 'OS X El Capitan';
            case this.os.MacOSSierra.test(name):
                this.agent.isMac = true;
                return 'macOS Sierra';
            case this.os.MacOSHighSierra.test(name):
                this.agent.isMac = true;
                return 'macOS High Sierra';
            case this.os.MacOSMojave.test(name):
                this.agent.isMac = true;
                return 'macOS Mojave';
            case this.os.Mac.test(name):
                // !('ontouchend' in document);
                // navigator.maxTouchPoints > 1
                this.agent.isMac = true;
                return 'OS X';
            case this.os.iPad.test(name):
                // 'ontouchend' in document;
                this.agent.isiPad = true;
                return name.match(this.os.iPad)[0].replace('_', '.');
            case this.os.iPhone.test(name):
                //  'ontouchend' in document;
                this.agent.isiPhone = true;
                return name.match(this.os.iPhone)[0].replace('_', '.');
            case this.os.Bada.test(name):
                this.agent.isBada = true;
                return 'Bada';
            case this.os.Curl.test(name):
                this.agent.isCurl = true;
                return 'Curl';
            case this.os.iOS.test(name):
                this.agent.isiPhone = true;
                return 'iOS';
            case this.os.Electron.test(name):
                this.agent.isElectron = true;
                return 'Electron';
            default:
                return 'unknown';
        }
    };

    private getPlatformSystem(name: string): string {
        switch (true) {
            case this.platform.Windows.test(name):
                return 'Microsoft Windows';
            case this.platform.WindowsPhone.test(name):
                this.agent.isWindowsPhone = true;
                return 'Microsoft Windows Phone';
            case this.platform.Mac.test(name):
                return 'Apple Mac';
            case this.platform.Curl.test(name):
                return 'Curl';
            case this.platform.Electron.test(name):
                this.agent.isElectron = true;
                return 'Electron';
            case this.platform.Android.test(name):
                this.agent.isAndroid = true;
                return 'Android';
            case this.platform.Blackberry.test(name):
                this.agent.isBlackberry = true;
                return 'Blackberry';
            case this.platform.Linux.test(name):
                return 'Linux';
            case this.platform.Wii.test(name):
                return 'Wii';
            case this.platform.Playstation.test(name):
                return 'Playstation';
            case this.platform.iPad.test(name):
                this.agent.isiPad = true;
                return 'iPad';
            case this.platform.iPod.test(name):
                this.agent.isiPad = true;
                return 'iPod';
            case this.platform.iPhone.test(name):
                this.agent.isiPhone = true;
                return 'iPhone';
            case this.platform.Samsung.test(name):
                this.agent.isSamsung = true;
                return 'Samsung';
            case this.platform.iOS.test(name):
                return 'Apple iOS';
            default:
                return 'unknown';
        }
    };


    detectUserAgent(): ISystemAgent {

        const os = this.getOperationSystemByHeader(this.getOperationSystem(this.agent.source));
        const platform = this.getPlatformSystem(this.agent.source);

        return {os, platform};
    }
}




