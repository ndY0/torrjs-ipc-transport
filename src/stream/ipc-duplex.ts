import { Duplex } from "stream";
import NodeIPC from "node-ipc";

class IpcDuplex extends Duplex {
  private ipc = NodeIPC;
  constructor(queueSize: number, private streamKey: string) {
    super({
      objectMode: true,
      highWaterMark: queueSize,
      autoDestroy: false,
      emitClose: false,
    });
    this.ipc.connectTo(this.ipc.config.id, () => {
      this.ipc.of[this.ipc.config.id].on(this.streamKey, (data: any) => {
        this.push(data);
      });
    });
  }

  _read() {}

  _write(data: any, _encoding: any, callback: (err?: Error) => void) {
    this.ipc.of[this.ipc.config.id].emit("event", {
      data,
      event: this.streamKey,
    });
    callback();
  }

  _destroy(err: Error | null, callback: (err: Error | null) => void) {
    this.ipc.disconnect(this.ipc.config.id);
    callback(null);
  }
}

export { IpcDuplex };
