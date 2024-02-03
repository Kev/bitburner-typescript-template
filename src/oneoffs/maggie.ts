import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    const a = ['a'];
    for (const b in a) {
        if (a.length < 10) {
            a.push('another');
        }
    }
    ns.tprint(a.join(','));
}
