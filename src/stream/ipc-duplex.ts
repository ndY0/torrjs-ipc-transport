import { Duplex } from "stream";
import NodeIPC from "node-ipc";

class IpcDuplex extends Duplex {
  private ipc = NodeIPC;
  private readMode: boolean = false;
  constructor(queueSize: number, private streamKey: string) {
    super({
      objectMode: true,
      highWaterMark: queueSize,
      autoDestroy: false,
      emitClose: false,
    });
    this.ipc.connectTo("server", () => {});
  }

  _read() {
    if (!this.readMode) {
      this.readMode = true;
      this.ipc.of.server.emit("register", this.streamKey);
      this.ipc.of.server.on(this.streamKey, (data: any) => {
        this.push(data);
      });
    }
  }

  _write(data: any, _encoding: any, callback: (err?: Error) => void) {
    this.ipc.of.server.emit("event", {
      data,
      event: this.streamKey,
    });
    callback();
  }

  _destroy(err: Error | null, callback: (err: Error | null) => void) {
    this.ipc.of.server.emit("disconnect", this.streamKey);
    callback(null);
  }
}

export { IpcDuplex };
