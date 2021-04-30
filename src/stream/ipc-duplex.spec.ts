import "reflect-metadata";
import { IpcDuplex } from "./ipc-duplex";
import { ServerExtension } from "../annotations/server-extension";
import { IpcServer } from "../impl/ipc.server";
import { InMemoryEmitter } from "torrjs-core/src/transports/in-memory-emitter";
import { memo, getMemoPromise, delay, putMemoValue } from "../utils";

@ServerExtension(new InMemoryEmitter(10))
class TestIpcServer extends IpcServer {}

describe("IpcDuplex", () => {
  describe("constructor", () => {
    it("should initiate a duplex stream in object mode, with given highwatermark, and reference ipc instance in property", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const ipcServer = new TestIpcServer();
      await Promise.all([
        ipcServer.start([], TestIpcServer, canceler, cancelerPromise).next(),
        (async () => {
          await delay(200);
          const ipcDuplex = new IpcDuplex(10, "test");
          expect(ipcDuplex.writableObjectMode).toBeTruthy();
          expect(ipcDuplex.readableObjectMode).toBeTruthy();
          expect(ipcDuplex.readableHighWaterMark).toEqual(10);
          expect(ipcDuplex.writableHighWaterMark).toEqual(10);
          const ipcInstance = Reflect.get(ipcDuplex, "ipc");
          expect(ipcInstance).not.toBeUndefined();
          await delay(300);
          putMemoValue(canceler, false);
        })(),
      ]);
    });
  });
  describe("write", () => {
    it("should send the event to the ipc server", async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const ipcServer = new TestIpcServer();
      await Promise.all([
        ipcServer.start([], TestIpcServer, canceler, cancelerPromise).next(),
        (async () => {
          await delay(200);
          const ipcDuplex = new IpcDuplex(10, "test");
          ipcDuplex.write({ test: "test" });
          await delay(300);
          putMemoValue(canceler, false);
        })(),
      ]);
    });
  });
  describe("read", () => {
    it(`should set the stream in reading mode, allowing consumption of events from ipc socket,
        and unregistering reading stream with destroy method`, async () => {
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const ipcServer = new TestIpcServer();
      await Promise.all([
        ipcServer.start([], TestIpcServer, canceler, cancelerPromise).next(),
        (async () => {
          await delay(200);
          const ipcDuplex1 = new IpcDuplex(10, "test");
          const ipcDuplex2 = new IpcDuplex(10, "test");
          ipcDuplex2.on("readable", () => {
            const data = ipcDuplex2.read(1);
            expect(data).toEqual({ test: "test" });
          });
          const shouldBeNull = ipcDuplex2.read();
          expect(shouldBeNull).toBeNull();
          expect(Reflect.get(ipcDuplex2, "readMode")).toBeTruthy();
          await delay(200);
          ipcDuplex1.write({ test: "test" });
          await delay(300);
          ipcDuplex2.destroy();
          await delay(300);
          putMemoValue(canceler, false);
        })(),
      ]);
    });
  });
});
