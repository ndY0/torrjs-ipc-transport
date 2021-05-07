import { InMemoryEmitter } from "torrjs-core/src/transports/in-memory-emitter";
import { IpcServer } from "./ipc.server";
import { memo, getMemoPromise, delay, putMemoValue } from "../utils";
import { keyForIdSymbol } from "torrjs-core/src/utils/symbols";
import NodeIPC from "node-ipc";
import { ServerExtension } from "../annotations/server-extension";
import { keyForSocketMap } from "../utils/symbols";

@ServerExtension(new InMemoryEmitter(10), { test: new InMemoryEmitter(10) })
class TestIpcServer extends IpcServer {}

describe("IpcServer", () => {
  describe("stopServer", () => {
    it("should stop the embedded state server", async () => {
      const ipcServer = new TestIpcServer();
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const stopSpy = jest.spyOn(ipcServer, "handleStopServer");
      ipcServer.start([], TestIpcServer, canceler, cancelerPromise).next();
      await delay(3_000);
      await TestIpcServer.stopServer(
        TestIpcServer,
        ipcServer[keyForIdSymbol]
      ).next();
      await delay(3_000);
      expect(stopSpy).toBeCalledTimes(1);
      await delay(500);
      putMemoValue(canceler, false);
    });
  });
  describe("emitServer", () => {
    it("should make the ipc server broadcast an 'event' event with given data and event name if a client connect and register", async () => {
      const ipcServer = new TestIpcServer();
      const canceler = memo(true);
      const cancelerPromise = getMemoPromise(canceler);
      const event = { event: "test", data: { test: "test" } };
      const emitSpy = jest.spyOn(ipcServer, "handleEmitServer");
      await Promise.all([
        ipcServer.start([], TestIpcServer, canceler, cancelerPromise).next(),
        (async () => {
          await delay(3_000);
          NodeIPC.connectTo("server", () => {
            NodeIPC.of.server.on("connect", () => {
              NodeIPC.of.server.emit("register", "test");
            });
            NodeIPC.of.server.on("test", (data: any) => {
              expect(data).toEqual({ test: "test" });
              const socketsMap = Reflect.get(ipcServer, keyForSocketMap);
              expect(socketsMap.get("test").length).toEqual(1);
              NodeIPC.of.server.emit("disconnect", "test");
            });
          });
          await delay(2_000);
          await TestIpcServer.emitServer(
            TestIpcServer,
            ipcServer[keyForIdSymbol],
            event
          ).next();
          await delay(4_000);
          const socketsMap = Reflect.get(ipcServer, keyForSocketMap);
          expect(socketsMap.get("test").length).toEqual(0);
          expect(emitSpy).toBeCalledTimes(1);
          putMemoValue(canceler, false);
          await delay(500);
        })(),
      ]);
    });
  });
});
