import { GenServer } from "torrjs-core/src/interfaces/genserver";
import EventEmitter from "events";
import NodeIPC from "node-ipc";

class IpcServer extends GenServer {
  protected async *init(
    ...args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    return [];
  }
  protected async *run<U extends typeof GenServer>(
    _canceler: Generator<[boolean, EventEmitter], never, boolean>,
    _cancelerPromise: Promise<boolean>,
    _context: U,
    _supervised: {
      id: string | null;
      canceler: Generator<[boolean, EventEmitter], never, boolean>;
    }[],
    _state: any
  ) {
    NodeIPC.config = {
      ...NodeIPC.config,
      maxConnections: Math.pow(2, 32) / 2 - 1,
    };
    NodeIPC.serve(() => {
      NodeIPC.server.on("event", (data) => {
        NodeIPC.server.emit(data.event, data.data);
      });
    });
    NodeIPC.server.start();
  }
}

export { IpcServer };
