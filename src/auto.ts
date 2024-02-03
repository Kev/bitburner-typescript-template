import { NS } from "@ns";
import { make_scripts } from './singularity';

export async function main(ns: NS): Promise<void> {
  make_scripts(ns);
  ns.spawn('auto/0.js', 1);
}
