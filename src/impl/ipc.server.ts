import { GenServer } from "torrjs-core/src/interfaces/genserver";
import { ReplyTypes } from "torrjs-core/src/events/types";
import { handle } from "torrjs-core/src/annotations/handle";
import NodeIPC from "node-ipc";
import { Server } from "torrjs-core/src/annotations/server";
import { InMemoryEmitter } from "torrjs-core/src/transports/in-memory-emitter";
import {
  keyForCombinedSelfReadable,
  keyForCombinedAdministrationSelfReadable,
  keyForIdSymbol,
} from "torrjs-core/src/utils/symbols";
import { CombineEmitter } from "torrjs-core/src/transports/combine-emitter";
import { memo, getMemoPromise, putMemoValue } from "../utils";
import { combineMemos, tail } from "torrjs-core/src/utils";
import EventEmitter from "events";
import { Socket } from "net";
import { keyForSocketMap } from "../utils/symbols";

@Server(new InMemoryEmitter(10))
abstract class IpcServer extends GenServer {
  private [keyForSocketMap]: Map<string, Socket[]> = new Map();
  protected async *init(
    ..._args: unknown[]
  ): AsyncGenerator<unknown, any, unknown> {
    NodeIPC.config = {
      ...NodeIPC.config,
      id: "server",
      maxConnections: Math.pow(2, 32) / 2 - 1,
    };
    NodeIPC.serve(() => {
      NodeIPC.server.on("register", (id, socket) => {
        const sockets = this[keyForSocketMap].get(id) || [];
        sockets.push(socket);
        this[keyForSocketMap].set(id, sockets);
      });
      NodeIPC.server.on("disconnect", (id, socket) => {
        let sockets =
          this[keyForSocketMap].get(id) || /* istanbul ignore next */ [];
        sockets = sockets.filter((candidate) => candidate !== socket);
        this[keyForSocketMap].set(id, sockets);
      });
      NodeIPC.server.on("event", (data) => {
        (
          this[keyForSocketMap].get(data.event) || /* istanbul ignore next */ []
        ).forEach((socket) => {
          NodeIPC.server.emit(socket, data.event, data.data);
        });
      });
    });
    return NodeIPC;
  }
  public async *start<U extends typeof GenServer>(
    startArgs: any[],
    context: U,
    canceler: Generator<[boolean, EventEmitter], never, boolean>,
    _cancelerPromise: Promise<boolean>
  ) {
    [
      context.eventEmitter,
      ...context.externalEventEmitters.values(),
    ].forEach((emitter) => emitter.resetInternalStreams());
    const combinableStreams = [
      context.eventEmitter,
      ...context.externalEventEmitters.values(),
    ].map((emitter) => {
      const stream = new (emitter.getInternalStreamType())();
      emitter.setStream(this[keyForIdSymbol], stream);
      return stream;
    });
    const combinableAdministrationStreams = [
      context.eventEmitter,
      ...context.externalEventEmitters.values(),
    ].map((emitter) => {
      const administrationStream = new (emitter.getInternalStreamType())();
      emitter.setStream(
        `${this[keyForIdSymbol]}_management`,
        administrationStream
      );
      return administrationStream;
    });
    this[keyForCombinedSelfReadable] = new CombineEmitter(combinableStreams);
    this[keyForCombinedAdministrationSelfReadable] = new CombineEmitter(
      combinableAdministrationStreams
    );
    const managementCanceler = memo(true);
    const combinedCanceler = combineMemos(
      (...states) => states.reduce((acc, curr) => acc && curr, true),
      managementCanceler,
      canceler
    );
    const combinedCancelerPromise = getMemoPromise(combinedCanceler);
    const ipcServer = yield* this.init(...startArgs);
    ipcServer.server.start();
    combinedCancelerPromise.then(
      (_) => (ipcServer.server.stop(), ipcServer.disconnect("server"))
    );
    await Promise.all([
      tail(
        (state: any) =>
          this.run(
            combinedCanceler,
            combinedCancelerPromise,
            context,
            [],
            state
          ),
        canceler,
        ipcServer,
        (state) => state === undefined
      ).then((value) => (putMemoValue(combinedCanceler, false), value)),
      tail(
        () =>
          this.runManagement(
            managementCanceler,
            combinedCancelerPromise,
            context
          ),
        combinedCanceler,
        null,
        (exitValue) => exitValue === undefined
      ),
    ]);
  }
  @handle("stop")
  private async *handleStopServer(state: typeof NodeIPC) {
    state.server.stop();
    return { type: ReplyTypes.NO_REPLY, newState: state };
  }
  @handle("emit")
  private async *handleEmitServer(
    state: typeof NodeIPC,
    { event, data }: { event: string; data: any }
  ) {
    state.server.emit(state.of.server.socket, "event", {
      event,
      data,
    });
    return { type: ReplyTypes.NO_REPLY, newState: state };
  }
  public static async *stopServer<T extends typeof IpcServer>(
    target: T,
    serverId: string,
    transport?: string
  ) {
    yield* GenServer.cast([target, serverId, transport], "stop");
  }
  public static async *emitServer<T extends typeof IpcServer>(
    target: T,
    serverId: string,
    { event, data }: { event: string; data: any },
    transport?: string
  ) {
    yield* GenServer.cast([target, serverId, transport], "emit", {
      event,
      data,
    });
  }
}

export { IpcServer };
