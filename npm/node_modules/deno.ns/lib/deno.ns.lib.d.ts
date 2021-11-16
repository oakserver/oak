// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

/// <reference types="node" />

import { URL } from "url";
import * as undici from "undici";

/**
 * EventTarget is a DOM interface implemented by objects that can receive events
 * and may have listeners for them.
 */
declare class EventTarget {
  /**
   * Appends an event listener for events whose type attribute value is type.
   * The callback argument sets the callback that will be invoked when the event
   * is dispatched.
   *
   * The options argument sets listener-specific options. For compatibility this
   * can be a boolean, in which case the method behaves exactly as if the value
   * was specified as options's capture.
   *
   * When set to true, options's capture prevents callback from being invoked
   * when the event's eventPhase attribute value is BUBBLING_PHASE. When false
   * (or not present), callback will not be invoked when event's eventPhase
   * attribute value is CAPTURING_PHASE. Either way, callback will be invoked if
   * event's eventPhase attribute value is AT_TARGET.
   *
   * When set to true, options's passive indicates that the callback will not
   * cancel the event by invoking preventDefault(). This is used to enable
   * performance optimizations described in § 2.8 Observing event listeners.
   *
   * When set to true, options's once indicates that the callback will only be
   * invoked once after which the event listener will be removed.
   *
   * The event listener is appended to target's event listener list and is not
   * appended if it has the same type, callback, and capture.
   */
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  /**
   * Dispatches a synthetic event event to target and returns true if either
   * event's cancelable attribute value is false or its preventDefault() method
   * was not invoked, and false otherwise.
   */
  dispatchEvent(event: Event): boolean;
  /**
   * Removes the event listener in target's event listener list with the same
   * type, callback, and options.
   */
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}

/** An event which takes place in the DOM. */
declare class Event {
  /**
   * Returns true or false depending on how event was initialized. True if
   * event goes through its target's ancestors in reverse tree order, and
   * false otherwise.
   */
  readonly bubbles: boolean;
  cancelBubble: boolean;
  /**
   * Returns true or false depending on how event was initialized. Its return
   * value does not always carry meaning, but true can indicate that part of the
   * operation during which event was dispatched, can be canceled by invoking
   * the preventDefault() method.
   */
  readonly cancelable: boolean;
  /**
   * Returns true or false depending on how event was initialized. True if
   * event invokes listeners past a ShadowRoot node that is the root of its
   * target, and false otherwise.
   */
  readonly composed: boolean;
  /**
   * Returns the object whose event listener's callback is currently being
   * invoked.
   */
  readonly currentTarget: EventTarget | null;
  /**
   * Returns true if preventDefault() was invoked successfully to indicate
   * cancellation, and false otherwise.
   */
  readonly defaultPrevented: boolean;
  /**
   * Returns the event's phase, which is one of NONE, CAPTURING_PHASE,
   * AT_TARGET, and BUBBLING_PHASE.
   */
  readonly eventPhase: number;
  /**
   * Returns true if event was dispatched by the user agent, and false
   * otherwise.
   */
  readonly isTrusted: boolean;
  /** Returns the object to which event is dispatched (its target). */
  readonly target: EventTarget | null;
  /**
   * Returns the event's timestamp as the number of milliseconds measured
   * relative to the time origin.
   */
  readonly timeStamp: number;
  /** Returns the type of event, e.g. "click", "hashchange", or "submit". */
  readonly type: string;
  readonly AT_TARGET: number;
  readonly BUBBLING_PHASE: number;
  readonly CAPTURING_PHASE: number;
  readonly NONE: number;
  static readonly AT_TARGET: number;
  static readonly BUBBLING_PHASE: number;
  static readonly CAPTURING_PHASE: number;
  static readonly NONE: number;
  constructor(type: string, eventInitDict?: EventInit);
  /**
   * Returns the invocation target objects of event's path (objects on which
   * listeners will be invoked), except for any nodes in shadow trees of which
   * the shadow root's mode is "closed" that are not reachable from event's
   * currentTarget.
   */
  composedPath(): EventTarget[];
  /**
   * If invoked when the cancelable attribute value is true, and while
   * executing a listener for the event with passive set to false, signals to
   * the operation that caused event to be dispatched that it needs to be
   * canceled.
   */
  preventDefault(): void;
  /**
   * Invoking this method prevents event from reaching any registered event
   * listeners after the current one finishes running and, when dispatched in a
   * tree, also prevents event from reaching any other objects.
   */
  stopImmediatePropagation(): void;
  /**
   * When dispatched in a tree, invoking this method prevents event from
   * reaching any objects other than the current object.
   */
  stopPropagation(): void;
}

interface EventInit {
  bubbles?: boolean;
  cancelable?: boolean;
  composed?: boolean;
}

interface EventListenerOptions {
  capture?: boolean;
}

interface AddEventListenerOptions extends EventListenerOptions {
  once?: boolean;
  passive?: boolean;
}

interface EventListener {
  (evt: Event): void | Promise<void>;
}

interface EventListenerObject {
  handleEvent(evt: Event): void | Promise<void>;
}

declare type EventListenerOrEventListenerObject = | EventListener
    | EventListenerObject;
export { Blob } from "buffer";
export { webcrypto as crypto } from "crypto";
export declare const fetch: (typeof globalThis) extends {
      "fetch": infer T;
  } ? T : typeof undici.fetch;
export declare type File = (typeof globalThis) extends {
      "File": infer T;
  } ? T : undici.File;
export declare const File: File;
export declare type FormData = (typeof globalThis) extends {
      "FormData": infer T;
  } ? T : undici.FormData;
export declare const FormData: FormData;
export declare type Headers = (typeof globalThis) extends {
      "Headers": infer T;
  } ? T : undici.Headers;
export declare const Headers: Headers;
export declare type Request = (typeof globalThis) extends {
      "Request": {
          prototype: infer T;
      };
  } ? T : undici.Request;
export declare const Request: Request;
export declare type Response = (typeof globalThis) extends {
      "Response": {
          prototype: infer T;
      };
  } ? T : undici.Response;
export declare const Response: Response;
export declare function setTimeout(cb: (...args: any[]) => void, delay?: number, ...args: any[]): number;
export declare function setInterval(cb: (...args: any[]) => void, delay?: number, ...args: any[]): number;
/**
 * Shows the given message and waits for the enter key pressed.
 * If the stdin is not interactive, it does nothing.
 * @param message
 */
export declare function alert(message?: string): void;
/**
 * Shows the given message and waits for the answer. Returns the user's answer as boolean.
 * Only `y` and `Y` are considered as true.
 * If the stdin is not interactive, it returns false.
 * @param message
 */
export declare function confirm(message?: string): boolean;
/**
 * Shows the given message and waits for the user's input. Returns the user's input as string.
 * If the default value is given and the user inputs the empty string, then it returns the given
 * default value.
 * If the default value is not given and the user inputs the empty string, it returns null.
 * If the stdin is not interactive, it returns null.
 * @param message
 * @param defaultValue
 */
export declare function prompt(message?: string, defaultValue?: string): string | null;

export declare namespace Deno {
  export class File implements Deno.File {
    readonly rid: number;
    constructor(rid: number);
    write(p: Uint8Array): Promise<number>;
    writeSync(p: Uint8Array): number;
    truncate(len?: number): Promise<void>;
    truncateSync(len?: number): void;
    read(p: Uint8Array): Promise<number | null>;
    readSync(p: Uint8Array): number | null;
    seek(offset: number, whence: Deno.SeekMode): Promise<number>;
    seekSync(offset: number, whence: Deno.SeekMode): number;
    stat(): Promise<Deno.FileInfo>;
    statSync(): Deno.FileInfo;
    close(): void;
  }

  export class Permissions implements Deno.Permissions {
    query(_desc: Deno.PermissionDescriptor): Promise<PermissionStatus>;
    revoke(_desc: Deno.PermissionDescriptor): Promise<PermissionStatus>;
    request(desc: Deno.PermissionDescriptor): Promise<PermissionStatus>;
  }

  export class PermissionStatus extends EventTarget implements Deno.PermissionStatus {
    readonly state: Deno.PermissionState;
    onchange: ((this: PermissionStatus, ev: Event) => any) | null;
  }

  export enum SeekMode {
    Start = 0,
    Current = 1,
    End = 2
  }

  /**
   * The `tty.isatty()` method returns `true` if the given `fd` is associated with
   * a TTY and `false` if it is not, including whenever `fd` is not a non-negative
   * integer.
   * @since v0.5.8
   * @param fd A numeric file descriptor
   */
  export function isatty(fd: number): boolean;
  /**
   * Change the current working directory to the specified path.
   *
   * ```ts
   * Deno.chdir("/home/userA");
   * Deno.chdir("../userB");
   * Deno.chdir("C:\\Program Files (x86)\\Java");
   * ```
   *
   * Throws `Deno.errors.NotFound` if directory not found.
   * Throws `Deno.errors.PermissionDenied` if the user does not have access
   * rights
   *
   * Requires --allow-read.
   */
  export function chdir(directory: string | URL): void;
  /**
   * Changes the permission of a specific file/directory of specified path.
   * Ignores the process's umask.
   *
   * ```ts
   * await Deno.chmod("/path/to/file", 0o666);
   * ```
   *
   * The mode is a sequence of 3 octal numbers.  The first/left-most number
   * specifies the permissions for the owner.  The second number specifies the
   * permissions for the group. The last/right-most number specifies the
   * permissions for others.  For example, with a mode of 0o764, the owner (7) can
   * read/write/execute, the group (6) can read/write and everyone else (4) can
   * read only.
   *
   * | Number | Description |
   * | ------ | ----------- |
   * | 7      | read, write, and execute |
   * | 6      | read and write |
   * | 5      | read and execute |
   * | 4      | read only |
   * | 3      | write and execute |
   * | 2      | write only |
   * | 1      | execute only |
   * | 0      | no permission |
   *
   * NOTE: This API currently throws on Windows
   *
   * Requires `allow-write` permission.
   */
  export function chmod(path: string | URL, mode: number): Promise<void>;
  /**
   * Synchronously changes the permission of a specific file/directory of
   * specified path.  Ignores the process's umask.
   *
   * ```ts
   * Deno.chmodSync("/path/to/file", 0o666);
   * ```
   *
   * For a full description, see [chmod](#Deno.chmod)
   *
   * NOTE: This API currently throws on Windows
   *
   * Requires `allow-write` permission.
   */
  export function chmodSync(path: string | URL, mode: number): void;
  /**
   * Change owner of a regular file or directory. This functionality
   * is not available on Windows.
   *
   * ```ts
   * await Deno.chown("myFile.txt", 1000, 1002);
   * ```
   *
   * Requires `allow-write` permission.
   *
   * Throws Error (not implemented) if executed on Windows
   *
   * @param path path to the file
   * @param uid user id (UID) of the new owner, or `null` for no change
   * @param gid group id (GID) of the new owner, or `null` for no change
   */
  export function chown(path: string | URL, uid: number | null, gid: number | null): Promise<void>;
  /**
   * Synchronously change owner of a regular file or directory. This functionality
   * is not available on Windows.
   *
   * ```ts
   * Deno.chownSync("myFile.txt", 1000, 1002);
   * ```
   *
   * Requires `allow-write` permission.
   *
   * Throws Error (not implemented) if executed on Windows
   *
   * @param path path to the file
   * @param uid user id (UID) of the new owner, or `null` for no change
   * @param gid group id (GID) of the new owner, or `null` for no change
   */
  export function chownSync(path: string | URL, uid: number | null, gid: number | null): void;
  /**
   * Close the given resource ID (rid) which has been previously opened, such
   * as via opening or creating a file.  Closing a file when you are finished
   * with it is important to avoid leaking resources.
   *
   * ```ts
   * const file = await Deno.open("my_file.txt");
   * // do work with "file" object
   * Deno.close(file.rid);
   * ````
   */
  export function close(rid: number): void;
  /**
   * Connects to the hostname (default is "127.0.0.1") and port on the named
   * transport (default is "tcp"), and resolves to the connection (`Conn`).
   *
   * ```ts
   * const conn1 = await Deno.connect({ port: 80 });
   * const conn2 = await Deno.connect({ hostname: "192.0.2.1", port: 80 });
   * const conn3 = await Deno.connect({ hostname: "[2001:db8::1]", port: 80 });
   * const conn4 = await Deno.connect({ hostname: "golang.org", port: 80, transport: "tcp" });
   * ```
   *
   * Requires `allow-net` permission for "tcp".
   */
  export function connect(options: ConnectOptions): Promise<Conn>;
  /**
   * *UNSTABLE**:  The unix socket transport is unstable as a new API yet to
   * be vetted.  The TCP transport is considered stable.
   *
   * Connects to the hostname (default is "127.0.0.1") and port on the named
   * transport (default is "tcp"), and resolves to the connection (`Conn`).
   *
   * ```ts
   * const conn1 = await Deno.connect({ port: 80 });
   * const conn2 = await Deno.connect({ hostname: "192.0.2.1", port: 80 });
   * const conn3 = await Deno.connect({ hostname: "[2001:db8::1]", port: 80 });
   * const conn4 = await Deno.connect({ hostname: "golang.org", port: 80, transport: "tcp" });
   * const conn5 = await Deno.connect({ path: "/foo/bar.sock", transport: "unix" });
   * ```
   *
   * Requires `allow-net` permission for "tcp" and `allow-read` for "unix".
   */
  export function connect(options: ConnectOptions | UnixConnectOptions): Promise<Conn>;
  /**
   * Establishes a secure connection over TLS (transport layer security) using
   * an optional cert file, hostname (default is "127.0.0.1") and port.  The
   * cert file is optional and if not included Mozilla's root certificates will
   * be used (see also https://github.com/ctz/webpki-roots for specifics)
   *
   * ```ts
   * const caCert = await Deno.readTextFile("./certs/my_custom_root_CA.pem");
   * const conn1 = await Deno.connectTls({ port: 80 });
   * const conn2 = await Deno.connectTls({ caCerts: [caCert], hostname: "192.0.2.1", port: 80 });
   * const conn3 = await Deno.connectTls({ hostname: "[2001:db8::1]", port: 80 });
   * const conn4 = await Deno.connectTls({ caCerts: [caCert], hostname: "golang.org", port: 80});
   * ```
   *
   * Requires `allow-net` permission.
   */
  export function connectTls(options: ConnectTlsOptions): Promise<TlsConn>;
  /**
   * *UNSTABLE** New API, yet to be vetted.
   *
   * Create a TLS connection with an attached client certificate.
   *
   * ```ts
   * const conn = await Deno.connectTls({
   *   hostname: "deno.land",
   *   port: 443,
   *   certChain: "---- BEGIN CERTIFICATE ----\n ...",
   *   privateKey: "---- BEGIN PRIVATE KEY ----\n ...",
   * });
   * ```
   *
   * Requires `allow-net` permission.
   */
  export function connectTls(options: ConnectTlsOptions): Promise<TlsConn>;
  /**
   * @deprecated Use `copy` from https://deno.land/std/streams/conversion.ts
   * instead. `Deno.copy` will be removed in Deno 2.0.
   *
   * Copies from `src` to `dst` until either EOF (`null`) is read from `src` or
   * an error occurs. It resolves to the number of bytes copied or rejects with
   * the first error encountered while copying.
   *
   * ```ts
   * const source = await Deno.open("my_file.txt");
   * const bytesCopied1 = await Deno.copy(source, Deno.stdout);
   * const destination = await Deno.create("my_file_2.txt");
   * const bytesCopied2 = await Deno.copy(source, destination);
   * ```
   * @param src The source to copy from
   * @param dst The destination to copy to
   * @param options Can be used to tune size of the buffer. Default size is 32kB
   */
  export function copy(src: Reader, dst: Writer, options?: {
      bufSize?: number;
    }): Promise<number>;
  /**
   * Copies the contents and permissions of one file to another specified path,
   * by default creating a new file if needed, else overwriting. Fails if target
   * path is a directory or is unwritable.
   *
   * ```ts
   * await Deno.copyFile("from.txt", "to.txt");
   * ```
   *
   * Requires `allow-read` permission on fromPath.
   * Requires `allow-write` permission on toPath.
   */
  export function copyFile(fromPath: string | URL, toPath: string | URL): Promise<void>;
  /**
   * Synchronously copies the contents and permissions of one file to another
   * specified path, by default creating a new file if needed, else overwriting.
   * Fails if target path is a directory or is unwritable.
   *
   * ```ts
   * Deno.copyFileSync("from.txt", "to.txt");
   * ```
   *
   * Requires `allow-read` permission on fromPath.
   * Requires `allow-write` permission on toPath.
   */
  export function copyFileSync(fromPath: string | URL, toPath: string | URL): void;
  /**
   * Creates a file if none exists or truncates an existing file and resolves to
   *  an instance of `Deno.File`.
   *
   * ```ts
   * const file = await Deno.create("/foo/bar.txt");
   * ```
   *
   * Requires `allow-read` and `allow-write` permissions.
   */
  export function create(path: string | URL): Promise<File>;
  /**
   * Creates a file if none exists or truncates an existing file and returns
   *  an instance of `Deno.File`.
   *
   * ```ts
   * const file = Deno.createSync("/foo/bar.txt");
   * ```
   *
   * Requires `allow-read` and `allow-write` permissions.
   */
  export function createSync(path: string | URL): File;
  /**
   * Return a string representing the current working directory.
   *
   * If the current directory can be reached via multiple paths (due to symbolic
   * links), `cwd()` may return any one of them.
   *
   * ```ts
   * const currentWorkingDirectory = Deno.cwd();
   * ```
   *
   * Throws `Deno.errors.NotFound` if directory not available.
   *
   * Requires --allow-read
   */
  export function cwd(): string;
  /**
   * Returns the path to the current deno executable.
   *
   * ```ts
   * console.log(Deno.execPath());  // e.g. "/home/alice/.local/bin/deno"
   * ```
   *
   * Requires `allow-read` permission.
   */
  export function execPath(): string;
  /**
   * Exit the Deno process with optional exit code. If no exit code is supplied
   * then Deno will exit with return code of 0.
   *
   * ```ts
   * Deno.exit(5);
   * ```
   */
  export function exit(code?: number): never;
  /**
   * Flushes any pending data operations of the given file stream to disk.
   *  ```ts
   * const file = await Deno.open("my_file.txt", { read: true, write: true, create: true });
   * await Deno.write(file.rid, new TextEncoder().encode("Hello World"));
   * await Deno.fdatasync(file.rid);
   * console.log(new TextDecoder().decode(await Deno.readFile("my_file.txt"))); // Hello World
   * ```
   */
  export function fdatasync(rid: number): Promise<void>;
  export function fdatasyncSync(rid: number): void;
  /**
   * Returns a `Deno.FileInfo` for the given file stream.
   *
   * ```ts
   * import { assert } from "https://deno.land/std/testing/asserts.ts";
   * const file = await Deno.open("file.txt", { read: true });
   * const fileInfo = await Deno.fstat(file.rid);
   * assert(fileInfo.isFile);
   * ```
   */
  export function fstat(rid: number): Promise<FileInfo>;
  /**
   * Synchronously returns a `Deno.FileInfo` for the given file stream.
   *
   * ```ts
   * import { assert } from "https://deno.land/std/testing/asserts.ts";
   * const file = Deno.openSync("file.txt", { read: true });
   * const fileInfo = Deno.fstatSync(file.rid);
   * assert(fileInfo.isFile);
   * ```
   */
  export function fstatSync(rid: number): FileInfo;
  /**
   * Flushes any pending data and metadata operations of the given file stream to disk.
   *  ```ts
   * const file = await Deno.open("my_file.txt", { read: true, write: true, create: true });
   * await Deno.write(file.rid, new TextEncoder().encode("Hello World"));
   * await Deno.ftruncate(file.rid, 1);
   * await Deno.fsync(file.rid);
   * console.log(new TextDecoder().decode(await Deno.readFile("my_file.txt"))); // H
   * ```
   */
  export function fsync(rid: number): Promise<void>;
  /**
   * Synchronously flushes any pending data and metadata operations of the given file stream to disk.
   *  ```ts
   * const file = Deno.openSync("my_file.txt", { read: true, write: true, create: true });
   * Deno.writeSync(file.rid, new TextEncoder().encode("Hello World"));
   * Deno.ftruncateSync(file.rid, 1);
   * Deno.fsyncSync(file.rid);
   * console.log(new TextDecoder().decode(Deno.readFileSync("my_file.txt"))); // H
   * ```
   */
  export function fsyncSync(rid: number): void;
  /**
   * Truncates or extends the specified file stream, to reach the specified `len`.
   *
   * If `len` is not specified then the entire file contents are truncated as if len was set to 0.
   *
   * If the file previously was larger than this new length, the extra  data  is  lost.
   *
   * If  the  file  previously  was shorter, it is extended, and the extended part reads as null bytes ('\0').
   *
   * ```ts
   * // truncate the entire file
   * const file = await Deno.open("my_file.txt", { read: true, write: true, create: true });
   * await Deno.ftruncate(file.rid);
   * ```
   *
   * ```ts
   * // truncate part of the file
   * const file = await Deno.open("my_file.txt", { read: true, write: true, create: true });
   * await Deno.write(file.rid, new TextEncoder().encode("Hello World"));
   * await Deno.ftruncate(file.rid, 7);
   * const data = new Uint8Array(32);
   * await Deno.read(file.rid, data);
   * console.log(new TextDecoder().decode(data)); // Hello W
   * ```
   */
  export function ftruncate(rid: number, len?: number): Promise<void>;
  /**
   * Synchronously truncates or extends the specified file stream, to reach the
   * specified `len`.
   *
   * If `len` is not specified then the entire file contents are truncated as if len was set to 0.
   *
   * if the file previously was larger than this new length, the extra  data  is  lost.
   *
   * if  the  file  previously  was shorter, it is extended, and the extended part reads as null bytes ('\0').
   *
   * ```ts
   * // truncate the entire file
   * const file = Deno.openSync("my_file.txt", { read: true, write: true, truncate: true, create: true });
   * Deno.ftruncateSync(file.rid);
   * ```
   *
   * ```ts
   * // truncate part of the file
   * const file = Deno.openSync("my_file.txt", { read: true, write: true, create: true });
   * Deno.writeSync(file.rid, new TextEncoder().encode("Hello World"));
   * Deno.ftruncateSync(file.rid, 7);
   * Deno.seekSync(file.rid, 0, Deno.SeekMode.Start);
   * const data = new Uint8Array(32);
   * Deno.readSync(file.rid, data);
   * console.log(new TextDecoder().decode(data)); // Hello W
   * ```
   */
  export function ftruncateSync(rid: number, len?: number): void;
  /**
   * Converts the input into a string that has the same format as printed by
   * `console.log()`.
   *
   * ```ts
   * const obj = {
   *   a: 10,
   *   b: "hello",
   * };
   * const objAsString = Deno.inspect(obj); // { a: 10, b: "hello" }
   * console.log(obj);  // prints same value as objAsString, e.g. { a: 10, b: "hello" }
   * ```
   *
   * You can also register custom inspect functions, via the symbol `Symbol.for("Deno.customInspect")`,
   * on objects, to control and customize the output.
   *
   * ```ts
   * class A {
   *   x = 10;
   *   y = "hello";
   *   [Symbol.for("Deno.customInspect")](): string {
   *     return "x=" + this.x + ", y=" + this.y;
   *   }
   * }
   *
   * const inStringFormat = Deno.inspect(new A()); // "x=10, y=hello"
   * console.log(inStringFormat);  // prints "x=10, y=hello"
   * ```
   *
   * Finally, you can also specify the depth to which it will format.
   *
   * ```ts
   * Deno.inspect({a: {b: {c: {d: 'hello'}}}}, {depth: 2}); // { a: { b: [Object] } }
   * ```
   */
  export function inspect(value: unknown, options?: InspectOptions): string;
  /**
   * Send a signal to process under given `pid`.
   *
   * If `pid` is negative, the signal will be sent to the process group
   * identified by `pid`.
   *
   *      const p = Deno.run({
   *        cmd: ["sleep", "10000"]
   *      });
   *
   *      Deno.kill(p.pid, "SIGINT");
   *
   * Requires `allow-run` permission.
   */
  export function kill(pid: number, signo: Signal): void;
  /**
   * Creates `newpath` as a hard link to `oldpath`.
   *
   * ```ts
   * await Deno.link("old/name", "new/name");
   * ```
   *
   * Requires `allow-read` and `allow-write` permissions.
   */
  export function link(oldpath: string, newpath: string): Promise<void>;
  /**
   * Synchronously creates `newpath` as a hard link to `oldpath`.
   *
   * ```ts
   * Deno.linkSync("old/name", "new/name");
   * ```
   *
   * Requires `allow-read` and `allow-write` permissions.
   */
  export function linkSync(oldpath: string, newpath: string): void;
  /**
   * Listen announces on the local transport address.
   *
   * ```ts
   * const listener1 = Deno.listen({ port: 80 })
   * const listener2 = Deno.listen({ hostname: "192.0.2.1", port: 80 })
   * const listener3 = Deno.listen({ hostname: "[2001:db8::1]", port: 80 });
   * const listener4 = Deno.listen({ hostname: "golang.org", port: 80, transport: "tcp" });
   * ```
   *
   * Requires `allow-net` permission.
   */
  export function listen(options: ListenOptions & { transport?: "tcp" }): Listener;
  /**
   * *UNSTABLE**: new API, yet to be vetted.
   *
   * Listen announces on the local transport address.
   *
   * ```ts
   * const listener = Deno.listen({ path: "/foo/bar.sock", transport: "unix" })
   * ```
   *
   * Requires `allow-read` and `allow-write` permission.
   */
  export function listen(options: UnixListenOptions & { transport: "unix" }): Listener;
  /**
   * Listen announces on the local transport address over TLS (transport layer
   * security).
   *
   * ```ts
   * const lstnr = Deno.listenTls({ port: 443, certFile: "./server.crt", keyFile: "./server.key" });
   * ```
   *
   * Requires `allow-net` permission.
   */
  export function listenTls(options: ListenTlsOptions): TlsListener;
  /**
   * Resolves to a `Deno.FileInfo` for the specified `path`. If `path` is a
   * symlink, information for the symlink will be returned instead of what it
   * points to.
   *
   * ```ts
   * import { assert } from "https://deno.land/std/testing/asserts.ts";
   * const fileInfo = await Deno.lstat("hello.txt");
   * assert(fileInfo.isFile);
   * ```
   *
   * Requires `allow-read` permission.
   */
  export function lstat(path: string | URL): Promise<FileInfo>;
  /**
   * Synchronously returns a `Deno.FileInfo` for the specified `path`. If
   * `path` is a symlink, information for the symlink will be returned instead of
   * what it points to..
   *
   * ```ts
   * import { assert } from "https://deno.land/std/testing/asserts.ts";
   * const fileInfo = Deno.lstatSync("hello.txt");
   * assert(fileInfo.isFile);
   * ```
   *
   * Requires `allow-read` permission.
   */
  export function lstatSync(path: string | URL): FileInfo;
  /**
   * Creates a new temporary directory in the default directory for temporary
   * files, unless `dir` is specified. Other optional options include
   * prefixing and suffixing the directory name with `prefix` and `suffix`
   * respectively.
   *
   * This call resolves to the full path to the newly created directory.
   *
   * Multiple programs calling this function simultaneously will create different
   * directories. It is the caller's responsibility to remove the directory when
   * no longer needed.
   *
   * ```ts
   * const tempDirName0 = await Deno.makeTempDir();  // e.g. /tmp/2894ea76
   * const tempDirName1 = await Deno.makeTempDir({ prefix: 'my_temp' }); // e.g. /tmp/my_temp339c944d
   * ```
   *
   * Requires `allow-write` permission.
   */
  export function makeTempDir(options?: MakeTempOptions): Promise<string>;
  /**
   * Synchronously creates a new temporary directory in the default directory
   * for temporary files, unless `dir` is specified. Other optional options
   * include prefixing and suffixing the directory name with `prefix` and
   * `suffix` respectively.
   *
   * The full path to the newly created directory is returned.
   *
   * Multiple programs calling this function simultaneously will create different
   * directories. It is the caller's responsibility to remove the directory when
   * no longer needed.
   *
   * ```ts
   * const tempDirName0 = Deno.makeTempDirSync();  // e.g. /tmp/2894ea76
   * const tempDirName1 = Deno.makeTempDirSync({ prefix: 'my_temp' });  // e.g. /tmp/my_temp339c944d
   * ```
   *
   * Requires `allow-write` permission.
   */
  export function makeTempDirSync(options?: MakeTempOptions): string;
  /**
   * Creates a new temporary file in the default directory for temporary
   * files, unless `dir` is specified.  Other
   * optional options include prefixing and suffixing the directory name with
   * `prefix` and `suffix` respectively.
   *
   * This call resolves to the full path to the newly created file.
   *
   * Multiple programs calling this function simultaneously will create different
   * files. It is the caller's responsibility to remove the file when no longer
   * needed.
   *
   * ```ts
   * const tmpFileName0 = await Deno.makeTempFile();  // e.g. /tmp/419e0bf2
   * const tmpFileName1 = await Deno.makeTempFile({ prefix: 'my_temp' });  // e.g. /tmp/my_temp754d3098
   * ```
   *
   * Requires `allow-write` permission.
   */
  export function makeTempFile(options?: MakeTempOptions): Promise<string>;
  /**
   * Synchronously creates a new temporary file in the default directory for
   * temporary files, unless `dir` is specified.
   * Other optional options include prefixing and suffixing the directory name
   * with `prefix` and `suffix` respectively.
   *
   * The full path to the newly created file is returned.
   *
   * Multiple programs calling this function simultaneously will create different
   * files. It is the caller's responsibility to remove the file when no longer
   * needed.
   *
   * ```ts
   * const tempFileName0 = Deno.makeTempFileSync(); // e.g. /tmp/419e0bf2
   * const tempFileName1 = Deno.makeTempFileSync({ prefix: 'my_temp' });  // e.g. /tmp/my_temp754d3098
   * ```
   *
   * Requires `allow-write` permission.
   */
  export function makeTempFileSync(options?: MakeTempOptions): string;
  /**
   * Returns an object describing the memory usage of the Deno process measured
   * in bytes.
   */
  export function memoryUsage(): MemoryUsage;
  /**
   * Creates a new directory with the specified path.
   *
   * ```ts
   * await Deno.mkdir("new_dir");
   * await Deno.mkdir("nested/directories", { recursive: true });
   * await Deno.mkdir("restricted_access_dir", { mode: 0o700 });
   * ```
   *
   * Defaults to throwing error if the directory already exists.
   *
   * Requires `allow-write` permission.
   */
  export function mkdir(path: string | URL, options?: MkdirOptions): Promise<void>;
  /**
   * Synchronously creates a new directory with the specified path.
   *
   * ```ts
   * Deno.mkdirSync("new_dir");
   * Deno.mkdirSync("nested/directories", { recursive: true });
   * Deno.mkdirSync("restricted_access_dir", { mode: 0o700 });
   * ```
   *
   * Defaults to throwing error if the directory already exists.
   *
   * Requires `allow-write` permission.
   */
  export function mkdirSync(path: string | URL, options?: MkdirOptions): void;
  /**
   * Open a file and resolve to an instance of `Deno.File`.  The
   * file does not need to previously exist if using the `create` or `createNew`
   * open options.  It is the callers responsibility to close the file when finished
   * with it.
   *
   * ```ts
   * const file = await Deno.open("/foo/bar.txt", { read: true, write: true });
   * // Do work with file
   * Deno.close(file.rid);
   * ```
   *
   * Requires `allow-read` and/or `allow-write` permissions depending on options.
   */
  export function open(path: string | URL, options?: OpenOptions): Promise<File>;
  /**
   * Synchronously open a file and return an instance of `Deno.File`.  The
   * file does not need to previously exist if using the `create` or `createNew`
   * open options.  It is the callers responsibility to close the file when finished
   * with it.
   *
   * ```ts
   * const file = Deno.openSync("/foo/bar.txt", { read: true, write: true });
   * // Do work with file
   * Deno.close(file.rid);
   * ```
   *
   * Requires `allow-read` and/or `allow-write` permissions depending on options.
   */
  export function openSync(path: string | URL, options?: OpenOptions): File;
  /**
   * Read from a resource ID (`rid`) into an array buffer (`buffer`).
   *
   * Resolves to either the number of bytes read during the operation or EOF
   * (`null`) if there was nothing more to read.
   *
   * It is possible for a read to successfully return with `0` bytes. This does
   * not indicate EOF.
   *
   * This function is one of the lowest level APIs and most users should not
   * work with this directly, but rather use Deno.readAll() instead.
   *
   * **It is not guaranteed that the full buffer will be read in a single call.**
   *
   * ```ts
   * // if "/foo/bar.txt" contains the text "hello world":
   * const file = await Deno.open("/foo/bar.txt");
   * const buf = new Uint8Array(100);
   * const numberOfBytesRead = await Deno.read(file.rid, buf); // 11 bytes
   * const text = new TextDecoder().decode(buf);  // "hello world"
   * Deno.close(file.rid);
   * ```
   */
  export function read(rid: number, buffer: Uint8Array): Promise<number | null>;
  /**
   * Reads the directory given by `path` and returns an async iterable of
   * `Deno.DirEntry`.
   *
   * ```ts
   * for await (const dirEntry of Deno.readDir("/")) {
   *   console.log(dirEntry.name);
   * }
   * ```
   *
   * Throws error if `path` is not a directory.
   *
   * Requires `allow-read` permission.
   */
  export function readDir(path: string | URL): AsyncIterable<DirEntry>;
  /**
   * Synchronously reads the directory given by `path` and returns an iterable
   * of `Deno.DirEntry`.
   *
   * ```ts
   * for (const dirEntry of Deno.readDirSync("/")) {
   *   console.log(dirEntry.name);
   * }
   * ```
   *
   * Throws error if `path` is not a directory.
   *
   * Requires `allow-read` permission.
   */
  export function readDirSync(path: string | URL): Iterable<DirEntry>;
  /**
   * Reads and resolves to the entire contents of a file as an array of bytes.
   * `TextDecoder` can be used to transform the bytes to string if required.
   * Reading a directory returns an empty data array.
   *
   * ```ts
   * const decoder = new TextDecoder("utf-8");
   * const data = await Deno.readFile("hello.txt");
   * console.log(decoder.decode(data));
   * ```
   *
   * Requires `allow-read` permission.
   */
  export function readFile(path: string | URL, options?: ReadFileOptions): Promise<Uint8Array>;
  /**
   * Synchronously reads and returns the entire contents of a file as an array
   * of bytes. `TextDecoder` can be used to transform the bytes to string if
   * required.  Reading a directory returns an empty data array.
   *
   * ```ts
   * const decoder = new TextDecoder("utf-8");
   * const data = Deno.readFileSync("hello.txt");
   * console.log(decoder.decode(data));
   * ```
   *
   * Requires `allow-read` permission.
   */
  export function readFileSync(path: string | URL): Uint8Array;
  /**
   * Resolves to the full path destination of the named symbolic link.
   *
   * ```ts
   * await Deno.symlink("./test.txt", "./test_link.txt");
   * const target = await Deno.readLink("./test_link.txt"); // full path of ./test.txt
   * ```
   *
   * Throws TypeError if called with a hard link
   *
   * Requires `allow-read` permission.
   */
  export function readLink(path: string | URL): Promise<string>;
  /**
   * Returns the full path destination of the named symbolic link.
   *
   * ```ts
   * Deno.symlinkSync("./test.txt", "./test_link.txt");
   * const target = Deno.readLinkSync("./test_link.txt"); // full path of ./test.txt
   * ```
   *
   * Throws TypeError if called with a hard link
   *
   * Requires `allow-read` permission.
   */
  export function readLinkSync(path: string | URL): string;
  /**
   * Synchronously read from a resource ID (`rid`) into an array buffer (`buffer`).
   *
   * Returns either the number of bytes read during the operation or EOF
   * (`null`) if there was nothing more to read.
   *
   * It is possible for a read to successfully return with `0` bytes. This does
   * not indicate EOF.
   *
   * This function is one of the lowest level APIs and most users should not
   * work with this directly, but rather use Deno.readAllSync() instead.
   *
   * **It is not guaranteed that the full buffer will be read in a single call.**
   *
   * ```ts
   * // if "/foo/bar.txt" contains the text "hello world":
   * const file = Deno.openSync("/foo/bar.txt");
   * const buf = new Uint8Array(100);
   * const numberOfBytesRead = Deno.readSync(file.rid, buf); // 11 bytes
   * const text = new TextDecoder().decode(buf);  // "hello world"
   * Deno.close(file.rid);
   * ```
   */
  export function readSync(rid: number, buffer: Uint8Array): number | null;
  /**
   * Asynchronously reads and returns the entire contents of a file as utf8
   *  encoded string. Reading a directory throws an error.
   *
   * ```ts
   * const data = await Deno.readTextFile("hello.txt");
   * console.log(data);
   * ```
   *
   * Requires `allow-read` permission.
   */
  export function readTextFile(path: string | URL, options?: ReadFileOptions): Promise<string>;
  /**
   * Synchronously reads and returns the entire contents of a file as utf8
   *  encoded string. Reading a directory throws an error.
   *
   * ```ts
   * const data = Deno.readTextFileSync("hello.txt");
   * console.log(data);
   * ```
   *
   * Requires `allow-read` permission.
   */
  export function readTextFileSync(path: string | URL): string;
  /**
   * Resolves to the absolute normalized path, with symbolic links resolved.
   *
   * ```ts
   * // e.g. given /home/alice/file.txt and current directory /home/alice
   * await Deno.symlink("file.txt", "symlink_file.txt");
   * const realPath = await Deno.realPath("./file.txt");
   * const realSymLinkPath = await Deno.realPath("./symlink_file.txt");
   * console.log(realPath);  // outputs "/home/alice/file.txt"
   * console.log(realSymLinkPath);  // outputs "/home/alice/file.txt"
   * ```
   *
   * Requires `allow-read` permission for the target path.
   * Also requires `allow-read` permission for the CWD if the target path is
   * relative.
   */
  export function realPath(path: string | URL): Promise<string>;
  /**
   * Returns absolute normalized path, with symbolic links resolved.
   *
   * ```ts
   * // e.g. given /home/alice/file.txt and current directory /home/alice
   * Deno.symlinkSync("file.txt", "symlink_file.txt");
   * const realPath = Deno.realPathSync("./file.txt");
   * const realSymLinkPath = Deno.realPathSync("./symlink_file.txt");
   * console.log(realPath);  // outputs "/home/alice/file.txt"
   * console.log(realSymLinkPath);  // outputs "/home/alice/file.txt"
   * ```
   *
   * Requires `allow-read` permission for the target path.
   * Also requires `allow-read` permission for the CWD if the target path is
   * relative.
   */
  export function realPathSync(path: string | URL): string;
  /**
   * Removes the named file or directory.
   *
   * ```ts
   * await Deno.remove("/path/to/empty_dir/or/file");
   * await Deno.remove("/path/to/populated_dir/or/file", { recursive: true });
   * ```
   *
   * Throws error if permission denied, path not found, or path is a non-empty
   * directory and the `recursive` option isn't set to `true`.
   *
   * Requires `allow-write` permission.
   */
  export function remove(path: string | URL, options?: RemoveOptions): Promise<void>;
  /**
   * Synchronously removes the named file or directory.
   *
   * ```ts
   * Deno.removeSync("/path/to/empty_dir/or/file");
   * Deno.removeSync("/path/to/populated_dir/or/file", { recursive: true });
   * ```
   *
   * Throws error if permission denied, path not found, or path is a non-empty
   * directory and the `recursive` option isn't set to `true`.
   *
   * Requires `allow-write` permission.
   */
  export function removeSync(path: string | URL, options?: RemoveOptions): void;
  /**
   * Renames (moves) `oldpath` to `newpath`.  Paths may be files or directories.
   * If `newpath` already exists and is not a directory, `rename()` replaces it.
   * OS-specific restrictions may apply when `oldpath` and `newpath` are in
   * different directories.
   *
   * ```ts
   * await Deno.rename("old/path", "new/path");
   * ```
   *
   * On Unix, this operation does not follow symlinks at either path.
   *
   * It varies between platforms when the operation throws errors, and if so what
   * they are. It's always an error to rename anything to a non-empty directory.
   *
   * Requires `allow-read` and `allow-write` permission.
   */
  export function rename(oldpath: string | URL, newpath: string | URL): Promise<void>;
  /**
   * Synchronously renames (moves) `oldpath` to `newpath`. Paths may be files or
   * directories.  If `newpath` already exists and is not a directory,
   * `renameSync()` replaces it. OS-specific restrictions may apply when
   * `oldpath` and `newpath` are in different directories.
   *
   * ```ts
   * Deno.renameSync("old/path", "new/path");
   * ```
   *
   * On Unix, this operation does not follow symlinks at either path.
   *
   * It varies between platforms when the operation throws errors, and if so what
   * they are. It's always an error to rename anything to a non-empty directory.
   *
   * Requires `allow-read` and `allow-write` permissions.
   */
  export function renameSync(oldpath: string | URL, newpath: string | URL): void;

  export class Process<T extends Deno.RunOptions = Deno.RunOptions> implements Deno.Process<T> {
    #private;
    get rid(): number;
    get pid(): number;
    get stdin(): T["stdin"] extends "piped" ? Deno.Writer & Deno.Closer : (Deno.Writer & Deno.Closer) | null;
    get stdout(): T["stdout"] extends "piped" ? Deno.Reader & Deno.Closer : (Deno.Reader & Deno.Closer) | null;
    get stderr(): T["stderr"] extends "piped" ? Deno.Reader & Deno.Closer : (Deno.Reader & Deno.Closer) | null;
    status(): Promise<Deno.ProcessStatus>;
    output(): Promise<Uint8Array>;
    stderrOutput(): Promise<Uint8Array>;
    close(): void;
    kill(signo: string): void;
  }

  /**
   * Spawns new subprocess.  RunOptions must contain at a minimum the `opt.cmd`,
   * an array of program arguments, the first of which is the binary.
   *
   * ```ts
   * const p = Deno.run({
   *   cmd: ["echo", "hello"],
   * });
   * ```
   *
   * Subprocess uses same working directory as parent process unless `opt.cwd`
   * is specified.
   *
   * Environmental variables from parent process can be cleared using `opt.clearEnv`.
   * Doesn't guarantee that only `opt.env` variables are present,
   * as the OS may set environmental variables for processes.
   *
   * Environmental variables for subprocess can be specified using `opt.env`
   * mapping.
   *
   * `opt.uid` sets the child process’s user ID. This translates to a setuid call
   * in the child process. Failure in the setuid call will cause the spawn to fail.
   *
   * `opt.gid` is similar to `opt.uid`, but sets the group ID of the child process.
   * This has the same semantics as the uid field.
   *
   * By default subprocess inherits stdio of parent process. To change that
   * `opt.stdout`, `opt.stderr` and `opt.stdin` can be specified independently -
   * they can be set to either an rid of open file or set to "inherit" "piped"
   * or "null":
   *
   * `"inherit"` The default if unspecified. The child inherits from the
   * corresponding parent descriptor.
   *
   * `"piped"` A new pipe should be arranged to connect the parent and child
   * sub-processes.
   *
   * `"null"` This stream will be ignored. This is the equivalent of attaching
   * the stream to `/dev/null`.
   *
   * Details of the spawned process are returned.
   *
   * Requires `allow-run` permission.
   */
  export function run<T extends RunOptions = RunOptions>(opt: T): Process<T>;
  export function run<T extends RunOptions & {
      clearEnv?: boolean;
      gid?: number;
      uid?: number;
    } = RunOptions & {
      clearEnv?: boolean;
      gid?: number;
      uid?: number;
    }>(opt: T): Process<T>;
  /**
   * Shutdown socket send operations.
   *
   * Matches behavior of POSIX shutdown(3).
   *
   * ```ts
   * const listener = Deno.listen({ port: 80 });
   * const conn = await listener.accept();
   * Deno.shutdown(conn.rid);
   * ```
   */
  export function shutdown(rid: number): Promise<void>;
  /**
   * Resolves to a `Deno.FileInfo` for the specified `path`. Will always
   * follow symlinks.
   *
   * ```ts
   * import { assert } from "https://deno.land/std/testing/asserts.ts";
   * const fileInfo = await Deno.stat("hello.txt");
   * assert(fileInfo.isFile);
   * ```
   *
   * Requires `allow-read` permission.
   */
  export function stat(path: string | URL): Promise<FileInfo>;
  /**
   * Synchronously returns a `Deno.FileInfo` for the specified `path`. Will
   * always follow symlinks.
   *
   * ```ts
   * import { assert } from "https://deno.land/std/testing/asserts.ts";
   * const fileInfo = Deno.statSync("hello.txt");
   * assert(fileInfo.isFile);
   * ```
   *
   * Requires `allow-read` permission.
   */
  export function statSync(path: string | URL): FileInfo;
  /**
   * Creates `newpath` as a symbolic link to `oldpath`.
   *
   * The options.type parameter can be set to `file` or `dir`. This argument is only
   * available on Windows and ignored on other platforms.
   *
   * ```ts
   * await Deno.symlink("old/name", "new/name");
   * ```
   *
   * Requires full `allow-read` and `allow-write` permissions.
   */
  export function symlink(oldpath: string | URL, newpath: string | URL, options?: SymlinkOptions): Promise<void>;
  /**
   * Creates `newpath` as a symbolic link to `oldpath`.
   *
   * The options.type parameter can be set to `file` or `dir`. This argument is only
   * available on Windows and ignored on other platforms.
   *
   * ```ts
   * Deno.symlinkSync("old/name", "new/name");
   * ```
   *
   * Requires full `allow-read` and `allow-write` permissions.
   */
  export function symlinkSync(oldpath: string | URL, newpath: string | URL, options?: SymlinkOptions): void;
  /**
   * Register a test which will be run when `deno test` is used on the command
   * line and the containing module looks like a test module.
   * `fn` can be async if required.
   * ```ts
   * import {assert, fail, assertEquals} from "https://deno.land/std/testing/asserts.ts";
   *
   * Deno.test({
   *   name: "example test",
   *   fn(): void {
   *     assertEquals("world", "world");
   *   },
   * });
   *
   * Deno.test({
   *   name: "example ignored test",
   *   ignore: Deno.build.os === "windows",
   *   fn(): void {
   *     // This test is ignored only on Windows machines
   *   },
   * });
   *
   * Deno.test({
   *   name: "example async test",
   *   async fn() {
   *     const decoder = new TextDecoder("utf-8");
   *     const data = await Deno.readFile("hello_world.txt");
   *     assertEquals(decoder.decode(data), "Hello world");
   *   }
   * });
   * ```
   */
  export function test(t: TestDefinition): void;
  /**
   * Register a test which will be run when `deno test` is used on the command
   * line and the containing module looks like a test module.
   * `fn` can be async if required.
   *
   * ```ts
   * import {assert, fail, assertEquals} from "https://deno.land/std/testing/asserts.ts";
   *
   * Deno.test("My test description", ():void => {
   *   assertEquals("hello", "hello");
   * });
   *
   * Deno.test("My async test description", async ():Promise<void> => {
   *   const decoder = new TextDecoder("utf-8");
   *   const data = await Deno.readFile("hello_world.txt");
   *   assertEquals(decoder.decode(data), "Hello world");
   * });
   * ```
   */
  export function test(name: string, fn: (t: TestContext) => void | Promise<void>): void;
  /**
   * Truncates or extends the specified file, to reach the specified `len`. If
   * `len` is not specified then the entire file contents are truncated.
   *
   * ```ts
   * // truncate the entire file
   * await Deno.truncate("my_file.txt");
   *
   * // truncate part of the file
   * const file = await Deno.makeTempFile();
   * await Deno.writeFile(file, new TextEncoder().encode("Hello World"));
   * await Deno.truncate(file, 7);
   * const data = await Deno.readFile(file);
   * console.log(new TextDecoder().decode(data));  // "Hello W"
   * ```
   *
   * Requires `allow-write` permission.
   */
  export function truncate(name: string, len?: number): Promise<void>;
  /**
   * Synchronously truncates or extends the specified file, to reach the
   * specified `len`.  If `len` is not specified then the entire file contents
   * are truncated.
   *
   * ```ts
   * // truncate the entire file
   * Deno.truncateSync("my_file.txt");
   *
   * // truncate part of the file
   * const file = Deno.makeTempFileSync();
   * Deno.writeFileSync(file, new TextEncoder().encode("Hello World"));
   * Deno.truncateSync(file, 7);
   * const data = Deno.readFileSync(file);
   * console.log(new TextDecoder().decode(data));
   * ```
   *
   * Requires `allow-write` permission.
   */
  export function truncateSync(name: string, len?: number): void;
  /**
   * Watch for file system events against one or more `paths`, which can be files
   * or directories.  These paths must exist already.  One user action (e.g.
   * `touch test.file`) can  generate multiple file system events.  Likewise,
   * one user action can result in multiple file paths in one event (e.g. `mv
   * old_name.txt new_name.txt`).  Recursive option is `true` by default and,
   * for directories, will watch the specified directory and all sub directories.
   * Note that the exact ordering of the events can vary between operating systems.
   *
   * ```ts
   * const watcher = Deno.watchFs("/");
   * for await (const event of watcher) {
   *    console.log(">>>> event", event);
   *    // { kind: "create", paths: [ "/foo.txt" ] }
   * }
   * ```
   *
   * Requires `allow-read` permission.
   *
   * Call `watcher.close()` to stop watching.
   *
   * ```ts
   * const watcher = Deno.watchFs("/");
   *
   * setTimeout(() => {
   *   watcher.close();
   * }, 5000);
   *
   * for await (const event of watcher) {
   *    console.log(">>>> event", event);
   * }
   * ```
   */
  export function watchFs(paths: string | string[], options?: { recursive: boolean }): FsWatcher;
  /**
   * Write to the resource ID (`rid`) the contents of the array buffer (`data`).
   *
   * Resolves to the number of bytes written.  This function is one of the lowest
   * level APIs and most users should not work with this directly, but rather use
   * Deno.writeAll() instead.
   *
   * **It is not guaranteed that the full buffer will be written in a single
   * call.**
   *
   * ```ts
   * const encoder = new TextEncoder();
   * const data = encoder.encode("Hello world");
   * const file = await Deno.open("/foo/bar.txt", { write: true });
   * const bytesWritten = await Deno.write(file.rid, data); // 11
   * Deno.close(file.rid);
   * ```
   */
  export function write(rid: number, data: Uint8Array): Promise<number>;
  /**
   * Write `data` to the given `path`, by default creating a new file if needed,
   * else overwriting.
   *
   * ```ts
   * const encoder = new TextEncoder();
   * const data = encoder.encode("Hello world\n");
   * await Deno.writeFile("hello1.txt", data);  // overwrite "hello1.txt" or create it
   * await Deno.writeFile("hello2.txt", data, {create: false});  // only works if "hello2.txt" exists
   * await Deno.writeFile("hello3.txt", data, {mode: 0o777});  // set permissions on new file
   * await Deno.writeFile("hello4.txt", data, {append: true});  // add data to the end of the file
   * ```
   *
   * Requires `allow-write` permission, and `allow-read` if `options.create` is `false`.
   */
  export function writeFile(path: string | URL, data: Uint8Array, options?: WriteFileOptions): Promise<void>;
  /**
   * Synchronously write `data` to the given `path`, by default creating a new
   * file if needed, else overwriting.
   *
   * ```ts
   * const encoder = new TextEncoder();
   * const data = encoder.encode("Hello world\n");
   * Deno.writeFileSync("hello1.txt", data);  // overwrite "hello1.txt" or create it
   * Deno.writeFileSync("hello2.txt", data, {create: false});  // only works if "hello2.txt" exists
   * Deno.writeFileSync("hello3.txt", data, {mode: 0o777});  // set permissions on new file
   * Deno.writeFileSync("hello4.txt", data, {append: true});  // add data to the end of the file
   * ```
   *
   * Requires `allow-write` permission, and `allow-read` if `options.create` is
   * `false`.
   */
  export function writeFileSync(path: string | URL, data: Uint8Array, options?: WriteFileOptions): void;
  /**
   * Synchronously write to the resource ID (`rid`) the contents of the array
   * buffer (`data`).
   *
   * Returns the number of bytes written.  This function is one of the lowest
   * level APIs and most users should not work with this directly, but rather use
   * Deno.writeAllSync() instead.
   *
   * **It is not guaranteed that the full buffer will be written in a single
   * call.**
   *
   * ```ts
   * const encoder = new TextEncoder();
   * const data = encoder.encode("Hello world");
   * const file = Deno.openSync("/foo/bar.txt", {write: true});
   * const bytesWritten = Deno.writeSync(file.rid, data); // 11
   * Deno.close(file.rid);
   * ```
   */
  export function writeSync(rid: number, data: Uint8Array): number;
  /**
   * Asynchronously write string `data` to the given `path`, by default creating a new file if needed,
   * else overwriting.
   *
   * ```ts
   * await Deno.writeTextFile("hello1.txt", "Hello world\n");  // overwrite "hello1.txt" or create it
   * ```
   *
   * Requires `allow-write` permission, and `allow-read` if `options.create` is `false`.
   */
  export function writeTextFile(path: string | URL, data: string, options?: WriteFileOptions): Promise<void>;
  /**
   * Synchronously write string `data` to the given `path`, by default creating a new file if needed,
   * else overwriting.
   *
   * ```ts
   * Deno.writeTextFileSync("hello1.txt", "Hello world\n");  // overwrite "hello1.txt" or create it
   * ```
   *
   * Requires `allow-write` permission, and `allow-read` if `options.create` is `false`.
   */
  export function writeTextFileSync(path: string | URL, data: string, options?: WriteFileOptions): void;
  /**
   * Returns the script arguments to the program. If for example we run a
   * program:
   *
   * deno run --allow-read https://deno.land/std/examples/cat.ts /etc/passwd
   *
   * Then `Deno.args` will contain:
   *
   * [ "/etc/passwd" ]
   */
  export const args: string[];
  export type Addr = NetAddr | UnixAddr;

  export interface Closer {
    close(): void;
  }

  export interface Conn extends Reader, Writer, Closer {
    /** The local address of the connection. */
    readonly localAddr: Addr;
    /** The remote address of the connection. */
    readonly remoteAddr: Addr;
    /** The resource ID of the connection. */
    readonly rid: number;
    /**
     * Shuts down (`shutdown(2)`) the write side of the connection. Most
     * callers should just use `close()`.
     */
    closeWrite(): Promise<void>;
  }

  export interface ConnectOptions {
    /** The port to connect to. */
    port: number;
    /**
     * A literal IP address or host name that can be resolved to an IP address.
     * If not specified, defaults to `127.0.0.1`.
     */
    hostname?: string;
    transport?: "tcp";
  }

  export interface ConnectTlsOptions {
    /** The port to connect to. */
    port: number;
    /**
     * A literal IP address or host name that can be resolved to an IP address.
     * If not specified, defaults to `127.0.0.1`.
     */
    hostname?: string;
    /**
     * @deprecated This option is deprecated and will be removed in a future
     * release.
     *
     * Server certificate file.
     */
    certFile?: string;
    /**
     * A list of root certificates that will be used in addition to the
     * default root certificates to verify the peer's certificate.
     *
     * Must be in PEM format.
     */
    caCerts?: string[];
  }

  export interface ConnectTlsOptions {
    /** PEM formatted client certificate chain. */
    certChain?: string;
    /** PEM formatted (RSA or PKCS8) private key of client certificate. */
    privateKey?: string;
  }

  export interface DirEntry {
    name: string;
    isFile: boolean;
    isDirectory: boolean;
    isSymlink: boolean;
  }

  export interface EnvPermissionDescriptor {
    name: "env";
    variable?: string;
  }

  export interface FfiPermissionDescriptor {
    name: "ffi";
    path?: string | URL;
  }

  /**
   * A FileInfo describes a file and is returned by `stat`, `lstat`,
   * `statSync`, `lstatSync`.
   */
  export interface FileInfo {
    /**
     * True if this is info for a regular file. Mutually exclusive to
     * `FileInfo.isDirectory` and `FileInfo.isSymlink`.
     */
    isFile: boolean;
    /**
     * True if this is info for a regular directory. Mutually exclusive to
     * `FileInfo.isFile` and `FileInfo.isSymlink`.
     */
    isDirectory: boolean;
    /**
     * True if this is info for a symlink. Mutually exclusive to
     * `FileInfo.isFile` and `FileInfo.isDirectory`.
     */
    isSymlink: boolean;
    /** The size of the file, in bytes. */
    size: number;
    /**
     * The last modification time of the file. This corresponds to the `mtime`
     * field from `stat` on Linux/Mac OS and `ftLastWriteTime` on Windows. This
     * may not be available on all platforms.
     */
    mtime: Date | null;
    /**
     * The last access time of the file. This corresponds to the `atime`
     * field from `stat` on Unix and `ftLastAccessTime` on Windows. This may not
     * be available on all platforms.
     */
    atime: Date | null;
    /**
     * The creation time of the file. This corresponds to the `birthtime`
     * field from `stat` on Mac/BSD and `ftCreationTime` on Windows. This may
     * not be available on all platforms.
     */
    birthtime: Date | null;
    /**
     * ID of the device containing the file.
     *
     * _Linux/Mac OS only._
     */
    dev: number | null;
    /**
     * Inode number.
     *
     * _Linux/Mac OS only._
     */
    ino: number | null;
    /**
     * *UNSTABLE**: Match behavior with Go on Windows for `mode`.
     *
     * The underlying raw `st_mode` bits that contain the standard Unix
     * permissions for this file/directory.
     */
    mode: number | null;
    /**
     * Number of hard links pointing to this file.
     *
     * _Linux/Mac OS only._
     */
    nlink: number | null;
    /**
     * User ID of the owner of this file.
     *
     * _Linux/Mac OS only._
     */
    uid: number | null;
    /**
     * Group ID of the owner of this file.
     *
     * _Linux/Mac OS only._
     */
    gid: number | null;
    /**
     * Device ID of this file.
     *
     * _Linux/Mac OS only._
     */
    rdev: number | null;
    /**
     * Blocksize for filesystem I/O.
     *
     * _Linux/Mac OS only._
     */
    blksize: number | null;
    /**
     * Number of blocks allocated to the file, in 512-byte units.
     *
     * _Linux/Mac OS only._
     */
    blocks: number | null;
  }

  export interface FsEvent {
    kind: "any" | "access" | "create" | "modify" | "remove";
    paths: string[];
  }

  /**
   * FsWatcher is returned by `Deno.watchFs` function when you start watching
   * the file system. You can iterate over this interface to get the file
   * system events, and also you can stop watching the file system by calling
   * `.close()` method.
   */
  export interface FsWatcher extends AsyncIterable<FsEvent> {
    /** The resource id of the `FsWatcher`. */
    readonly rid: number;
    /** Stops watching the file system and closes the watcher resource. */
    close(): void;
    /**
     * @deprecated
     * Stops watching the file system and closes the watcher resource.
     * Will be removed at 2.0.
     */
    return?(value?: any): Promise<IteratorResult<FsEvent>>;
    [Symbol.asyncIterator](): AsyncIterableIterator<FsEvent>;
  }

  export interface HrtimePermissionDescriptor {
    name: "hrtime";
  }

  export interface HttpConn extends AsyncIterable<RequestEvent> {
    readonly rid: number;
    nextRequest(): Promise<RequestEvent | null>;
    close(): void;
  }

  export interface InspectOptions {
    /** Stylize output with ANSI colors. Defaults to false. */
    colors?: boolean;
    /**
     * Try to fit more than one entry of a collection on the same line.
     * Defaults to true.
     */
    compact?: boolean;
    /** Traversal depth for nested objects. Defaults to 4. */
    depth?: number;
    /** The maximum number of iterable entries to print. Defaults to 100. */
    iterableLimit?: number;
    /** Show a Proxy's target and handler. Defaults to false. */
    showProxy?: boolean;
    /** Sort Object, Set and Map entries by key. Defaults to false. */
    sorted?: boolean;
    /** Add a trailing comma for multiline collections. Defaults to false. */
    trailingComma?: boolean;
    /** Evaluate the result of calling getters. Defaults to false. */
    getters?: boolean;
    /** Show an object's non-enumerable properties. Defaults to false. */
    showHidden?: boolean;
  }

  /** A generic network listener for stream-oriented protocols. */
  export interface Listener extends AsyncIterable<Conn> {
    /** Return the address of the `Listener`. */
    readonly addr: Addr;
    /** Return the rid of the `Listener`. */
    readonly rid: number;
    /** Waits for and resolves to the next connection to the `Listener`. */
    accept(): Promise<Conn>;
    /**
     * Close closes the listener. Any pending accept promises will be rejected
     * with errors.
     */
    close(): void;
    [Symbol.asyncIterator](): AsyncIterableIterator<Conn>;
  }

  export interface ListenOptions {
    /** The port to listen on. */
    port: number;
    /**
     * A literal IP address or host name that can be resolved to an IP address.
     * If not specified, defaults to `0.0.0.0`.
     *
     * __Note about `0.0.0.0`__ While listening `0.0.0.0` works on all platforms,
     * the browsers on Windows don't work with the address `0.0.0.0`.
     * You should show the message like `server running on localhost:8080` instead of
     * `server running on 0.0.0.0:8080` if your program supports Windows.
     */
    hostname?: string;
  }

  export interface ListenTlsOptions extends ListenOptions {
    /**
     * Path to a file containing a PEM formatted CA certificate. Requires
     * `--allow-read`.
     */
    certFile: string;
    /** Server public key file. Requires `--allow-read`. */
    keyFile: string;
    transport?: "tcp";
  }

  export interface ListenTlsOptions {
    /**
     * *UNSTABLE**: new API, yet to be vetted.
     *
     * Application-Layer Protocol Negotiation (ALPN) protocols to announce to
     * the client. If not specified, no ALPN extension will be included in the
     * TLS handshake.
     */
    alpnProtocols?: string[];
  }

  export interface MakeTempOptions {
    /**
     * Directory where the temporary directory should be created (defaults to
     * the env variable TMPDIR, or the system's default, usually /tmp).
     *
     * Note that if the passed `dir` is relative, the path returned by
     * makeTempFile() and makeTempDir() will also be relative. Be mindful of
     * this when changing working directory.
     */
    dir?: string;
    /**
     * String that should precede the random portion of the temporary
     * directory's name.
     */
    prefix?: string;
    /**
     * String that should follow the random portion of the temporary
     * directory's name.
     */
    suffix?: string;
  }

  export interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  }

  export interface Metrics extends OpMetrics {
    ops: Record<string, OpMetrics>;
  }

  export interface MkdirOptions {
    /**
     * Defaults to `false`. If set to `true`, means that any intermediate
     * directories will also be created (as with the shell command `mkdir -p`).
     * Intermediate directories are created with the same permissions.
     * When recursive is set to `true`, succeeds silently (without changing any
     * permissions) if a directory already exists at the path, or if the path
     * is a symlink to an existing directory.
     */
    recursive?: boolean;
    /**
     * Permissions to use when creating the directory (defaults to `0o777`,
     * before the process's umask).
     * Ignored on Windows.
     */
    mode?: number;
  }

  export interface NetAddr {
    transport: "tcp" | "udp";
    hostname: string;
    port: number;
  }

  export interface NetPermissionDescriptor {
    name: "net";
    /**
     * Optional host string of the form `"<hostname>[:<port>]"`. Examples:
     *
     *      "github.com"
     *      "deno.land:8080"
     */
    host?: string;
  }

  export interface OpenOptions {
    /**
     * Sets the option for read access. This option, when `true`, means that the
     * file should be read-able if opened.
     */
    read?: boolean;
    /**
     * Sets the option for write access. This option, when `true`, means that
     * the file should be write-able if opened. If the file already exists,
     * any write calls on it will overwrite its contents, by default without
     * truncating it.
     */
    write?: boolean;
    /**
     * Sets the option for the append mode. This option, when `true`, means that
     * writes will append to a file instead of overwriting previous contents.
     * Note that setting `{ write: true, append: true }` has the same effect as
     * setting only `{ append: true }`.
     */
    append?: boolean;
    /**
     * Sets the option for truncating a previous file. If a file is
     * successfully opened with this option set it will truncate the file to `0`
     * size if it already exists. The file must be opened with write access
     * for truncate to work.
     */
    truncate?: boolean;
    /**
     * Sets the option to allow creating a new file, if one doesn't already
     * exist at the specified path. Requires write or append access to be
     * used.
     */
    create?: boolean;
    /**
     * Defaults to `false`. If set to `true`, no file, directory, or symlink is
     * allowed to exist at the target location. Requires write or append
     * access to be used. When createNew is set to `true`, create and truncate
     * are ignored.
     */
    createNew?: boolean;
    /**
     * Permissions to use if creating the file (defaults to `0o666`, before
     * the process's umask).
     * Ignored on Windows.
     */
    mode?: number;
  }

  export interface OpMetrics {
    opsDispatched: number;
    opsDispatchedSync: number;
    opsDispatchedAsync: number;
    opsDispatchedAsyncUnref: number;
    opsCompleted: number;
    opsCompletedSync: number;
    opsCompletedAsync: number;
    opsCompletedAsyncUnref: number;
    bytesSentControl: number;
    bytesSentData: number;
    bytesReceived: number;
  }

  /**
   * Permission descriptors which define a permission and can be queried,
   * requested, or revoked.
   */
  export type PermissionDescriptor = | RunPermissionDescriptor
        | ReadPermissionDescriptor
        | WritePermissionDescriptor
        | NetPermissionDescriptor
        | EnvPermissionDescriptor
        | FfiPermissionDescriptor
        | HrtimePermissionDescriptor;
  /** The name of a "powerful feature" which needs permission. */
  export type PermissionName = | "run"
        | "read"
        | "write"
        | "net"
        | "env"
        | "ffi"
        | "hrtime";
  /** The current status of the permission. */
  export type PermissionState = "granted" | "denied" | "prompt";

  export interface PermissionStatusEventMap {
    "change": Event;
  }

  export type ProcessStatus = | {
          success: true;
          code: 0;
          signal?: undefined;
        }
        | {
          success: false;
          code: number;
          signal?: number;
        };

  export interface Reader {
    /**
     * Reads up to `p.byteLength` bytes into `p`. It resolves to the number of
     * bytes read (`0` < `n` <= `p.byteLength`) and rejects if any error
     * encountered. Even if `read()` resolves to `n` < `p.byteLength`, it may
     * use all of `p` as scratch space during the call. If some data is
     * available but not `p.byteLength` bytes, `read()` conventionally resolves
     * to what is available instead of waiting for more.
     *
     * When `read()` encounters end-of-file condition, it resolves to EOF
     * (`null`).
     *
     * When `read()` encounters an error, it rejects with an error.
     *
     * Callers should always process the `n` > `0` bytes returned before
     * considering the EOF (`null`). Doing so correctly handles I/O errors that
     * happen after reading some bytes and also both of the allowed EOF
     * behaviors.
     *
     * Implementations should not retain a reference to `p`.
     *
     * Use iter() from https://deno.land/std/io/util.ts to turn a Reader into an
     * AsyncIterator.
     */
    read(p: Uint8Array): Promise<number | null>;
  }

  export interface ReaderSync {
    /**
     * Reads up to `p.byteLength` bytes into `p`. It resolves to the number
     * of bytes read (`0` < `n` <= `p.byteLength`) and rejects if any error
     * encountered. Even if `readSync()` returns `n` < `p.byteLength`, it may use
     * all of `p` as scratch space during the call. If some data is available
     * but not `p.byteLength` bytes, `readSync()` conventionally returns what is
     * available instead of waiting for more.
     *
     * When `readSync()` encounters end-of-file condition, it returns EOF
     * (`null`).
     *
     * When `readSync()` encounters an error, it throws with an error.
     *
     * Callers should always process the `n` > `0` bytes returned before
     * considering the EOF (`null`). Doing so correctly handles I/O errors that happen
     * after reading some bytes and also both of the allowed EOF behaviors.
     *
     * Implementations should not retain a reference to `p`.
     *
     * Use iterSync() from https://deno.land/std/io/util.ts to turn a ReaderSync
     * into an Iterator.
     */
    readSync(p: Uint8Array): number | null;
  }

  export interface ReadFileOptions {
    /**
     * An abort signal to allow cancellation of the file read operation.
     * If the signal becomes aborted the readFile operation will be stopped
     * and the promise returned will be rejected with an AbortError.
     */
    signal?: AbortSignal;
  }

  export interface ReadPermissionDescriptor {
    name: "read";
    path?: string | URL;
  }

  export interface RemoveOptions {
    /**
     * Defaults to `false`. If set to `true`, path will be removed even if
     * it's a non-empty directory.
     */
    recursive?: boolean;
  }

  export interface RequestEvent {
    readonly request: Request;
    respondWith(r: Response | Promise<Response>): Promise<void>;
  }

  export interface ResourceMap {
    [rid: number]: any;
  }

  export interface RunOptions {
    /**
     * Arguments to pass. Note, the first element needs to be a path to the
     * binary
     */
    cmd: string[] | [URL, ...string[]];
    cwd?: string;
    env?: {
        [key: string]: string;
      };
    stdout?: "inherit" | "piped" | "null" | number;
    stderr?: "inherit" | "piped" | "null" | number;
    stdin?: "inherit" | "piped" | "null" | number;
  }

  export interface RunPermissionDescriptor {
    name: "run";
    command?: string | URL;
  }

  export interface Seeker {
    /**
     * Seek sets the offset for the next `read()` or `write()` to offset,
     * interpreted according to `whence`: `Start` means relative to the
     * start of the file, `Current` means relative to the current offset,
     * and `End` means relative to the end. Seek resolves to the new offset
     * relative to the start of the file.
     *
     * Seeking to an offset before the start of the file is an error. Seeking to
     * any positive offset is legal, but the behavior of subsequent I/O
     * operations on the underlying object is implementation-dependent.
     * It returns the number of cursor position.
     */
    seek(offset: number, whence: SeekMode): Promise<number>;
  }

  export interface SeekerSync {
    /**
     * Seek sets the offset for the next `readSync()` or `writeSync()` to
     * offset, interpreted according to `whence`: `Start` means relative
     * to the start of the file, `Current` means relative to the current
     * offset, and `End` means relative to the end.
     *
     * Seeking to an offset before the start of the file is an error. Seeking to
     * any positive offset is legal, but the behavior of subsequent I/O
     * operations on the underlying object is implementation-dependent.
     */
    seekSync(offset: number, whence: SeekMode): number;
  }

  export type Signal = | "SIGABRT"
        | "SIGALRM"
        | "SIGBUS"
        | "SIGCHLD"
        | "SIGCONT"
        | "SIGEMT"
        | "SIGFPE"
        | "SIGHUP"
        | "SIGILL"
        | "SIGINFO"
        | "SIGINT"
        | "SIGIO"
        | "SIGKILL"
        | "SIGPIPE"
        | "SIGPROF"
        | "SIGPWR"
        | "SIGQUIT"
        | "SIGSEGV"
        | "SIGSTKFLT"
        | "SIGSTOP"
        | "SIGSYS"
        | "SIGTERM"
        | "SIGTRAP"
        | "SIGTSTP"
        | "SIGTTIN"
        | "SIGTTOU"
        | "SIGURG"
        | "SIGUSR1"
        | "SIGUSR2"
        | "SIGVTALRM"
        | "SIGWINCH"
        | "SIGXCPU"
        | "SIGXFSZ";
  export type SymlinkOptions = {
        type: "file" | "dir";
      };

  export interface TestDefinition {
    fn: (t: TestContext) => void | Promise<void>;
    name: string;
    ignore?: boolean;
    /**
     * If at least one test has `only` set to true, only run tests that have
     * `only` set to true and fail the test suite.
     */
    only?: boolean;
    /**
     * Check that the number of async completed ops after the test is the same
     * as number of dispatched ops. Defaults to true.
     */
    sanitizeOps?: boolean;
    /**
     * Ensure the test case does not "leak" resources - ie. the resource table
     * after the test has exactly the same contents as before the test. Defaults
     * to true.
     */
    sanitizeResources?: boolean;
    /**
     * Ensure the test case does not prematurely cause the process to exit,
     * for example via a call to `Deno.exit`. Defaults to true.
     */
    sanitizeExit?: boolean;
    /**
     * Specifies the permissions that should be used to run the test.
     * Set this to "inherit" to keep the calling thread's permissions.
     * Set this to "none" to revoke all permissions.
     *
     * Defaults to "inherit".
     */
    permissions?: "inherit" | "none" | {
            /** Specifies if the `net` permission should be requested or revoked.
             * If set to `"inherit"`, the current `env` permission will be inherited.
             * If set to `true`, the global `net` permission will be requested.
             * If set to `false`, the global `net` permission will be revoked.
             *
             * Defaults to "inherit".
             */
            env?: "inherit" | boolean | string[];

            /** Specifies if the `hrtime` permission should be requested or revoked.
             * If set to `"inherit"`, the current `hrtime` permission will be inherited.
             * If set to `true`, the global `hrtime` permission will be requested.
             * If set to `false`, the global `hrtime` permission will be revoked.
             *
             * Defaults to "inherit".
             */
            hrtime?: "inherit" | boolean;

            /** Specifies if the `net` permission should be requested or revoked.
             * if set to `"inherit"`, the current `net` permission will be inherited.
             * if set to `true`, the global `net` permission will be requested.
             * if set to `false`, the global `net` permission will be revoked.
             * if set to `string[]`, the `net` permission will be requested with the
             * specified host strings with the format `"<host>[:<port>]`.
             *
             * Defaults to "inherit".
             *
             * Examples:
             *
             * ```ts
             * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
             *
             * Deno.test({
             *   name: "inherit",
             *   permissions: {
             *     net: "inherit",
             *   },
             *   async fn() {
             *     const status = await Deno.permissions.query({ name: "net" })
             *     assertEquals(status.state, "granted");
             *   },
             * });
             * ```
             *
             * ```ts
             * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
             *
             * Deno.test({
             *   name: "true",
             *   permissions: {
             *     net: true,
             *   },
             *   async fn() {
             *     const status = await Deno.permissions.query({ name: "net" });
             *     assertEquals(status.state, "granted");
             *   },
             * });
             * ```
             *
             * ```ts
             * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
             *
             * Deno.test({
             *   name: "false",
             *   permissions: {
             *     net: false,
             *   },
             *   async fn() {
             *     const status = await Deno.permissions.query({ name: "net" });
             *     assertEquals(status.state, "denied");
             *   },
             * });
             * ```
             *
             * ```ts
             * import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
             *
             * Deno.test({
             *   name: "localhost:8080",
             *   permissions: {
             *     net: ["localhost:8080"],
             *   },
             *   async fn() {
             *     const status = await Deno.permissions.query({ name: "net", host: "localhost:8080" });
             *     assertEquals(status.state, "granted");
             *   },
             * });
             * ```
             */
            net?: "inherit" | boolean | string[];

            /** Specifies if the `ffi` permission should be requested or revoked.
             * If set to `"inherit"`, the current `ffi` permission will be inherited.
             * If set to `true`, the global `ffi` permission will be requested.
             * If set to `false`, the global `ffi` permission will be revoked.
             *
             * Defaults to "inherit".
             */
            ffi?: "inherit" | boolean | Array<string | URL>;

            /** Specifies if the `read` permission should be requested or revoked.
             * If set to `"inherit"`, the current `read` permission will be inherited.
             * If set to `true`, the global `read` permission will be requested.
             * If set to `false`, the global `read` permission will be revoked.
             * If set to `Array<string | URL>`, the `read` permission will be requested with the
             * specified file paths.
             *
             * Defaults to "inherit".
             */
            read?: "inherit" | boolean | Array<string | URL>;

            /** Specifies if the `run` permission should be requested or revoked.
             * If set to `"inherit"`, the current `run` permission will be inherited.
             * If set to `true`, the global `run` permission will be requested.
             * If set to `false`, the global `run` permission will be revoked.
             *
             * Defaults to "inherit".
             */
            run?: "inherit" | boolean | Array<string | URL>;

            /** Specifies if the `write` permission should be requested or revoked.
             * If set to `"inherit"`, the current `write` permission will be inherited.
             * If set to `true`, the global `write` permission will be requested.
             * If set to `false`, the global `write` permission will be revoked.
             * If set to `Array<string | URL>`, the `write` permission will be requested with the
             * specified file paths.
             *
             * Defaults to "inherit".
             */
            write?: "inherit" | boolean | Array<string | URL>;
          };
  }

  export interface TlsConn extends Conn {
    /**
     * Runs the client or server handshake protocol to completion if that has
     * not happened yet. Calling this method is optional; the TLS handshake
     * will be completed automatically as soon as data is sent or received.
     */
    handshake(): Promise<void>;
  }

  /** Specialized listener that accepts TLS connections. */
  export interface TlsListener extends Listener, AsyncIterable<TlsConn> {
    /** Waits for a TLS client to connect and accepts the connection. */
    accept(): Promise<TlsConn>;
    [Symbol.asyncIterator](): AsyncIterableIterator<TlsConn>;
  }

  export interface UnixAddr {
    transport: "unix" | "unixpacket";
    path: string;
  }

  /** Options for writing to a file. */
  export interface WriteFileOptions {
    /**
     * Defaults to `false`. If set to `true`, will append to a file instead of
     * overwriting previous contents.
     */
    append?: boolean;
    /**
     * Sets the option to allow creating a new file, if one doesn't already
     * exist at the specified path (defaults to `true`).
     */
    create?: boolean;
    /** Permissions always applied to file. */
    mode?: number;
    /**
     * An abort signal to allow cancellation of the file write operation.
     * If the signal becomes aborted the writeFile operation will be stopped
     * and the promise returned will be rejected with an AbortError.
     */
    signal?: AbortSignal;
  }

  export interface WritePermissionDescriptor {
    name: "write";
    path?: string | URL;
  }

  export interface Writer {
    /**
     * Writes `p.byteLength` bytes from `p` to the underlying data stream. It
     * resolves to the number of bytes written from `p` (`0` <= `n` <=
     * `p.byteLength`) or reject with the error encountered that caused the
     * write to stop early. `write()` must reject with a non-null error if
     * would resolve to `n` < `p.byteLength`. `write()` must not modify the
     * slice data, even temporarily.
     *
     * Implementations should not retain a reference to `p`.
     */
    write(p: Uint8Array): Promise<number>;
  }

  export interface WriterSync {
    /**
     * Writes `p.byteLength` bytes from `p` to the underlying data
     * stream. It returns the number of bytes written from `p` (`0` <= `n`
     * <= `p.byteLength`) and any error encountered that caused the write to
     * stop early. `writeSync()` must throw a non-null error if it returns `n` <
     * `p.byteLength`. `writeSync()` must not modify the slice data, even
     * temporarily.
     *
     * Implementations should not retain a reference to `p`.
     */
    writeSync(p: Uint8Array): number;
  }

  /** Build related information. */
  export const build: {
    /** The LLVM target triple */
    target: string;
    /** Instruction set architecture */
    arch: "x86_64" | "aarch64";
    /** Operating system */
    os: "darwin" | "linux" | "windows";
    /** Computer vendor */
    vendor: string;
    /** Optional environment */
    env?: string;
    };
  export const customInspect: unique symbol;
  export const env: {
        /** Retrieve the value of an environment variable. Returns `undefined` if that
         * key doesn't exist.
         *
         * ```ts
         * console.log(Deno.env.get("HOME"));  // e.g. outputs "/home/alice"
         * console.log(Deno.env.get("MADE_UP_VAR"));  // outputs "undefined"
         * ```
         * Requires `allow-env` permission. */
        get(key: string): string | undefined;

        /** Set the value of an environment variable.
         *
         * ```ts
         * Deno.env.set("SOME_VAR", "Value");
         * Deno.env.get("SOME_VAR");  // outputs "Value"
         * ```
         *
         * Requires `allow-env` permission. */
        set(key: string, value: string): void;

        /** Delete the value of an environment variable.
         *
         * ```ts
         * Deno.env.set("SOME_VAR", "Value");
         * Deno.env.delete("SOME_VAR");  // outputs "undefined"
         * ```
         *
         * Requires `allow-env` permission. */
        delete(key: string): void;

        /** Returns a snapshot of the environment variables at invocation.
         *
         * ```ts
         * Deno.env.set("TEST_VAR", "A");
         * const myEnv = Deno.env.toObject();
         * console.log(myEnv.SHELL);
         * Deno.env.set("TEST_VAR", "B");
         * console.log(myEnv.TEST_VAR);  // outputs "A"
         * ```
         *
         * Requires `allow-env` permission. */
        toObject(): { [index: string]: string };
      };

  export namespace errors {
    export class AddrInUse extends Error {
    }

    export class AddrNotAvailable extends Error {
    }

    export class AlreadyExists extends Error {
    }

    export class BadResource extends Error {
    }

    export class BrokenPipe extends Error {
    }

    export class Busy extends Error {
    }

    export class ConnectionAborted extends Error {
    }

    export class ConnectionRefused extends Error {
    }

    export class ConnectionReset extends Error {
    }

    export class Http extends Error {
    }

    export class Interrupted extends Error {
    }

    export class InvalidData extends Error {
    }

    export class NotConnected extends Error {
    }

    export class NotFound extends Error {
    }

    export class PermissionDenied extends Error {
    }

    export class TimedOut extends Error {
    }

    export class UnexpectedEof extends Error {
    }

    export class WriteZero extends Error {
    }
  }

  /** The URL of the entrypoint module entered from the command-line. */
  export const mainModule: string;
  /**
   * Receive metrics from the privileged side of Deno. This is primarily used
   * in the development of Deno. 'Ops', also called 'bindings', are the go-between
   * between Deno JavaScript and Deno Rust.
   *
   *      > console.table(Deno.metrics())
   *      ┌─────────────────────────┬────────┐
   *      │         (index)         │ Values │
   *      ├─────────────────────────┼────────┤
   *      │      opsDispatched      │   3    │
   *      │    opsDispatchedSync    │   2    │
   *      │   opsDispatchedAsync    │   1    │
   *      │ opsDispatchedAsyncUnref │   0    │
   *      │      opsCompleted       │   3    │
   *      │    opsCompletedSync     │   2    │
   *      │    opsCompletedAsync    │   1    │
   *      │ opsCompletedAsyncUnref  │   0    │
   *      │    bytesSentControl     │   73   │
   *      │      bytesSentData      │   0    │
   *      │      bytesReceived      │  375   │
   *      └─────────────────────────┴────────┘
   */
  export function metrics(): Metrics;
  /**
   * Reflects the `NO_COLOR` environment variable at program start.
   *
   * See: https://no-color.org/
   */
  export const noColor: boolean;
  /** Deno's permission management API. */
  export const permissions: Permissions;
  /** The current process id of the runtime. */
  export const pid: number;
  /**
   * The pid of the current process's parent.
   */
  export const ppid: number;
  /**
   * Returns a map of open resource ids (rid) along with their string
   * representations. This is an internal API and as such resource
   * representation has `any` type; that means it can change any time.
   *
   * ```ts
   * console.log(Deno.resources());
   * // { 0: "stdin", 1: "stdout", 2: "stderr" }
   * Deno.openSync('../test.file');
   * console.log(Deno.resources());
   * // { 0: "stdin", 1: "stdout", 2: "stderr", 3: "fsFile" }
   * ```
   */
  export function resources(): ResourceMap;
  /** Version related information. */
  export const version: {
    /** Deno's version. For example: `"1.0.0"` */
    deno: string;
    /** The V8 version used by Deno. For example: `"8.0.0.0"` */
    v8: string;
    /** The TypeScript version used by Deno. For example: `"4.0.0"` */
    typescript: string;
    };
  /** A handle for `stdin`. */
  export const stdin: Reader & ReaderSync & Closer & { readonly rid: number };
  /** A handle for `stdout`. */
  export const stdout: Writer & WriterSync & Closer & { readonly rid: number };
  /** A handle for `stderr`. */
  export const stderr: Writer & WriterSync & Closer & { readonly rid: number };

  /** *UNSTABLE**: New option, yet to be vetted. */
  export interface TestContext {
  }

  /** *UNSTABLE**: New option, yet to be vetted. */
  export interface TestContext {
    /**
     * Run a sub step of the parent test with a given name. Returns a promise
     * that resolves to a boolean signifying if the step completed successfully.
     * The returned promise never rejects unless the arguments are invalid.
     * If the test was ignored, the promise returns `false`.
     */
    step(t: TestStepDefinition): Promise<boolean>;
    /**
     * Run a sub step of the parent test with a given name. Returns a promise
     * that resolves to a boolean signifying if the step completed successfully.
     * The returned promise never rejects unless the arguments are invalid.
     * If the test was ignored, the promise returns `false`.
     */
    step(name: string, fn: (t: TestContext) => void | Promise<void>): Promise<boolean>;
  }

  /** *UNSTABLE**: New option, yet to be vetted. */
  export interface TestStepDefinition {
    fn: (t: TestContext) => void | Promise<void>;
    name: string;
    ignore?: boolean;
    /**
     * Check that the number of async completed ops after the test is the same
     * as number of dispatched ops. Defaults to true.
     */
    sanitizeOps?: boolean;
    /**
     * Ensure the test case does not "leak" resources - ie. the resource table
     * after the test has exactly the same contents as before the test. Defaults
     * to true.
     */
    sanitizeResources?: boolean;
    /**
     * Ensure the test case does not prematurely cause the process to exit,
     * for example via a call to `Deno.exit`. Defaults to true.
     */
    sanitizeExit?: boolean;
  }

  export interface UnixConnectOptions {
    transport: "unix";
    path: string;
  }

  export interface UnixListenOptions {
    /** A Path to the Unix Socket. */
    path: string;
  }

  /**
   * *UNSTABLE**: needs investigation into high precision time.
   *
   * Changes the access (`atime`) and modification (`mtime`) times of a file
   * stream resource referenced by `rid`. Given times are either in seconds
   * (UNIX epoch time) or as `Date` objects.
   *
   * ```ts
   * const file = await Deno.open("file.txt", { create: true, write: true });
   * await Deno.futime(file.rid, 1556495550, new Date());
   * ```
   */
  export function futime(rid: number, atime: number | Date, mtime: number | Date): Promise<void>;
  /**
   * *UNSTABLE**: needs investigation into high precision time.
   *
   * Synchronously changes the access (`atime`) and modification (`mtime`) times
   * of a file stream resource referenced by `rid`. Given times are either in
   * seconds (UNIX epoch time) or as `Date` objects.
   *
   * ```ts
   * const file = Deno.openSync("file.txt", { create: true, write: true });
   * Deno.futimeSync(file.rid, 1556495550, new Date());
   * ```
   */
  export function futimeSync(rid: number, atime: number | Date, mtime: number | Date): void;
  /**
   * *UNSTABLE**: needs investigation into high precision time.
   *
   * Changes the access (`atime`) and modification (`mtime`) times of a file
   * system object referenced by `path`. Given times are either in seconds
   * (UNIX epoch time) or as `Date` objects.
   *
   * ```ts
   * await Deno.utime("myfile.txt", 1556495550, new Date());
   * ```
   *
   * Requires `allow-write` permission.
   */
  export function utime(path: string | URL, atime: number | Date, mtime: number | Date): Promise<void>;
  /**
   * *UNSTABLE**: needs investigation into high precision time.
   *
   * Synchronously changes the access (`atime`) and modification (`mtime`) times
   * of a file system object referenced by `path`. Given times are either in
   * seconds (UNIX epoch time) or as `Date` objects.
   *
   * ```ts
   * Deno.utimeSync("myfile.txt", 1556495550, new Date());
   * ```
   *
   * Requires `allow-write` permission.
   */
  export function utimeSync(path: string | URL, atime: number | Date, mtime: number | Date): void;
}

declare module "deno.ns/deno" {
  export = Deno;
}

declare module "deno.ns/global" {
}

declare module "deno.ns/test-internals" {
  /** Reference to the array that `Deno.test` calls insert their definition into. */
  export const testDefinitions: Deno.TestDefinition[];
}
