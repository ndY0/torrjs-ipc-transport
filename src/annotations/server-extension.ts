import "reflect-metadata";
import { TransportEmitter } from "../transport/interface";
import { GenServer } from "torrjs-core/src/interfaces/genserver";
import { GenApplication } from "torrjs-core/src/interfaces/genapplication";
import { keyForMetadataMapSymbol } from "torrjs-core/src/utils/symbols";

function ServerExtension(
  transport: TransportEmitter,
  externalTransports?: { [key: string]: TransportEmitter } & {
    internal?: never;
  }
) {
  return <T extends typeof GenServer, U extends typeof GenApplication>(
    constructor: T | U
  ) => {
    const externalTransportsMap: Map<string, TransportEmitter> = new Map();
    if (externalTransports) {
      Object.keys(externalTransports).forEach((key) => {
        externalTransportsMap.set(key, externalTransports[key]);
      });
    }
    Reflect.defineProperty(constructor, "externalEventEmitters", {
      configurable: false,
      enumerable: false,
      value: externalTransportsMap,
      writable: false,
    });
    Reflect.deleteMetadata(keyForMetadataMapSymbol, constructor.prototype);
    Reflect.defineProperty(constructor, "eventEmitter", {
      configurable: false,
      enumerable: false,
      value: transport,
      writable: false,
    });
  };
}

export { ServerExtension };
