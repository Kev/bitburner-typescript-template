import { NS } from '@ns'
import { hgw_once } from './base';

export async function main(ns: NS): Promise<void> {
    await hgw_once(ns, ns.weaken, "weaken");
}