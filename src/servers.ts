import { NS } from '@ns'

function string_in(s: string, a: Array<string>) {
    for (const i of a) {
        if (s == i) {
            return true;
        }
    }
    return false;
}

function recurse(ns: NS, host: string, path: Array<string>): void {
    const adjacents: Array<string> = ns.scan(host);
    if (ns.getServer(host).purchasedByPlayer && host != 'home') {
        return;
    }
    ns.print(path.join(' -> '));
    for (const adjacent of adjacents) {
        if (string_in(adjacent, path)) {
            continue;
        }
        const next_path = [...path];
        next_path.push(adjacent);
        if (ns.hasRootAccess(adjacent)) {
            recurse(ns, adjacent, next_path);
        } else {
            ns.print(next_path.join(' -> '), '(NO ROOT)');
        }
    }
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    ns.tail()

    recurse(ns, 'home', ['home']);
}





