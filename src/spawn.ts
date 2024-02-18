import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.run(ns.args[0] as string);
}
