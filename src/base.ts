import { BasicHGWOptions, NS } from "@ns";

export const port_hacks = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
export const faction_servers = ['CSEC', 'avmnite-02h', 'I.I.I.I', 'run4theh111z'];

export const colours = {
    black: "\u001b[30m",
    red: "\u001b[31m",
    green: "\u001b[32m",
    yellow: "\u001b[33m",
    blue: "\u001b[34m",
    magenta: "\u001b[35m",
    cyan: "\u001b[36m",
    white: "\u001b[37m",
    brightBlack: "\u001b[30;1m",
    brightRed: "\u001b[31;1m",
    brightGreen: "\u001b[32;1m",
    brightYellow: "\u001b[33;1m",
    brightBlue: "\u001b[34;1m",
    brightMagenta: "\u001b[35;1m",
    brightCyan: "\u001b[36;1m",
    brightWhite: "\u001b[37;1m",
    reset: "\u001b[0m"
};

export function available_port_hacks(ns: NS): Array<string> {
    return port_hacks.filter(port_hack => ns.fileExists(port_hack))
}

export class Server {
    name = '';
    path: Array<string> = new Array<string>();
    rooted = false;
    max_cash = 0;
    hacking_score = 0;
    mine = false; // home or purchased
}

function string_in(s: string, a: Array<string>) {
    for (const i of a) {
        if (s == i) {
            return true;
        }
    }
    return false;
}

function recurse_servers(ns: NS, host: string, path: Array<string>, servers: Array<Server>): void {
    const adjacents: Array<string> = ns.scan(host);

    const ns_server = ns.getServer(host);
    const server = new Server();
    server.name = host;
    server.path = [...path];
    server.rooted = true;
    server.mine = ns_server.purchasedByPlayer;
    if (!(ns_server.purchasedByPlayer || host == "home")) {
        const chance_to_hack = ns.hackAnalyzeChance(host);
        const amount_per_hack = ns.hackAnalyze(host);
        server.max_cash = ns_server.moneyMax || 0;
        server.hacking_score = chance_to_hack * amount_per_hack * (ns_server.moneyMax || 0);
    }

    servers.push(server);
    for (const adjacent of adjacents) {
        if (string_in(adjacent, path)) {
            continue;
        }
        const next_path = [...path];
        next_path.push(adjacent);
        if (ns.hasRootAccess(adjacent)) {
            recurse_servers(ns, adjacent, next_path, servers);
        } else {
            const server = new Server();
            server.name = adjacent;
            server.path = [...next_path];
            server.rooted = false;
            servers.push(server);
        }
    }
}

export function find_servers(ns: NS): Array<Server> {
    const servers = new Array<Server>();
    recurse_servers(ns, 'home', ['home'], servers);
    ns.write('servers_cache.txt', JSON.stringify(servers), 'w');
    return servers;
}

export function cached_servers(ns: NS): Array<Server> {
    const servers = ns.read('servers_cache.txt');
    if (servers == null) {
        return [];
    }
    return JSON.parse(servers);
}

export function cached_server(ns: NS, name: string): Server | null {
    const servers = cached_servers(ns);
    for (const server of servers) {
        if (server.name == name) {
            return server;
        }
    }
    return null;
}

export function best_targets_uncached(ns: NS, n: number): Array<string> {
    const hacking_level = ns.getHackingLevel();
    if (n == 1 && hacking_level < 600) {
        return [ns.getHackingLevel() >= 200 ? 'phantasy' : (hacking_level >= 20 ? 'joesguns' : 'n00dles')];
    }
    const servers = find_servers(ns).filter(server => server.rooted && !server.mine);
    servers.sort((a, b) => b.hacking_score - a.hacking_score);
    return servers.slice(0, n).map(server => server.name);
}

export function rooted(servers: Array<Server>): Array<string> {
    return servers.filter(server => server.rooted).map(server => server.name);
}

export async function farm_out(ns: NS, script: string, threads: number, ...args: Array<string>): Promise<number[]> {
    ns.print("Farming out ", script, " with ", threads, " threads, args: ", args.join(", "));
    const servers = rooted(cached_servers(ns));
    if (threads == 0) return [];
    for (const server of servers) {
        ns.scp(script, server);
        ns.scp('base.js', server);
    }
    const pids: Array<number> = [];
    // ns.print("Available servers: ", servers.join(", "));
    while (threads > 0) {
        for (const server of servers) {
            if (threads <= 0) {
                break;
            }
            const server_ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
            const script_ram = ns.getScriptRam(script, server);
            const threads_to_use = Math.min(threads, Math.floor(server_ram / script_ram));
            if (threads_to_use < 1) {
                continue;
            }
            // ns.print("    Using ", threads_to_use, " threads on ", server, " at a RAM cost of ", ns.formatRam(threads_to_use * script_ram));
            pids.push(ns.exec(script, server, threads_to_use, ...args));
            threads -= threads_to_use;
        }
        await ns.sleep(100);
        if (!Number.isFinite(threads)) {
            break;
        }
    }
    return pids;
}


export async function wait_for(ns: NS, pids: Array<number>) {
    ns.print("  Waiting for ", pids.length, " processes to finish.");
    while (pids.length > 0) {
        const pid = pids.pop() || 0;
        while (ns.isRunning(pid)) {
            await ns.sleep(100);
        }
    }
}

export async function prepare_server(ns: NS, target: string, wait = true) {
    ns.print("Preparing server ", target);
    const excess_security = ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target);
    const weaken_security = 0.05;
    const weakens_needed = Math.ceil(excess_security / weaken_security);
    ns.print("  Weakening ", weakens_needed, " times for ", excess_security, " excess security");
    const initial_weaken_pids = await farm_out(ns, 'weaken_once.js', weakens_needed, target);
    const current_money = ns.getServerMoneyAvailable(target);
    const max_money = ns.getServer(target).moneyMax || 0;
    const grow_proportion = current_money >= max_money ? 0 : max_money / current_money;
    ns.print("  Current money is ", ns.formatNumber(current_money), " and max money is ", ns.formatNumber(max_money), " so grow proportion is ", ns.formatNumber(grow_proportion));
    if (grow_proportion > 0) {
        if (!isFinite(grow_proportion)) {
            ns.print("    Found an infinite grow proportion, so doing a max run of growth and then running prepare again");
            await wait_for(ns, await farm_out(ns, 'grow_once.js', Infinity, target));
            ns.print("    Pre-growth complete, starting preparation again");
            await ns.sleep(10);
            await prepare_server(ns, target);
            return;
        }
        const grow_threads = Math.ceil(ns.growthAnalyze(target, grow_proportion));
        const grow_security = ns.growthAnalyzeSecurity(grow_threads, target);
        const security_threads = Math.ceil(grow_security / weaken_security);
        ns.print("Growing ", grow_threads, " times for ", ns.formatNumber(grow_proportion), " growth (", ns.formatNumber(max_money - current_money), " short)");
        const grow_pids = await farm_out(ns, 'grow_once.js', grow_threads, target);
        ns.print("Weakening ", security_threads, " times for ", ns.formatNumber(grow_security), " security, with predicted effect ", ns.formatNumber(ns.weakenAnalyze(security_threads)));
        const security_pids = await farm_out(ns, 'weaken_once.js', security_threads, target);
        if (wait) {
            await wait_for(ns, grow_pids);
            await wait_for(ns, security_pids);
        }
    }
    if (wait) {
        await wait_for(ns, initial_weaken_pids);
    }
}

export async function hwgw(ns: NS, server: string, hack_threads: number, hack_weaken_threads: number, grow_threads: number, grow_weaken_threads: number, target: string, hack_time: number, grow_time: number, weaken_time: number, port: number, batch: number) {
    ns.run('hwgw.js', 1, server, hack_threads, hack_weaken_threads, grow_threads, grow_weaken_threads, target, hack_time, grow_time, weaken_time, port, batch);
}

export async function hgw_once(ns: NS, func: (target: string, options: BasicHGWOptions) => Promise<number>, port_text: string): Promise<void> {
    if (ns.args.length < 1) {
        ns.tprint("Usage: hgw_once.js target [target_end_time duration port batch]");
        return;
    }
    const target = ns.args[0] as string;
    let delay = 0;
    const script_start_time = 0;
    let function_start_time = 0;
    let target_end_time = 0;
    let duration = 0;
    if (ns.args.length > 1) {
        target_end_time = ns.args[1] as number;
        duration = ns.args[2] as number;
        // All the tasks are being scheduled to finish on a round second, so start them on a half second to avoid starting in the middle of the HWGW completing when the sec/cash is off
        // script_start_time = Date.now();
        // const time_until_mid_second = 1500 - (script_start_time % 1000);
        // if (time_until_mid_second > 0) {
        //     await ns.sleep(time_until_mid_second);
        // }
        function_start_time = Date.now();
        delay = target_end_time - function_start_time - duration;
        if (delay < 0) {
            ns.alert("Delay is negative for " + target + ": " + delay as string + "\n" + "Current time is " + new Date(function_start_time).toISOString() + ", " + "target time is " + new Date(target_end_time).toISOString() + ", " + "duration is " + duration as string);
        }
    }
    const options = delay > 0 ? { 'additionalMsec': delay } : {};
    await func(target, options);
    if (ns.args.length > 3) {
        const port = ns.args[3] as number;
        const batch = ns.args[4] as number;
        const message = JSON.stringify({ what: port_text, target: target, delay: delay, duration: duration, completion: Date.now(), runner: ns.getHostname(), script_start_time: script_start_time, function_start_time: function_start_time, target_end_time: target_end_time, batch: batch });
        ns.write("a_batch_completions.txt", `${message as string},\n`, 'a');
        // if (ns.writePort(port, message)) {
        //     // ns.print("Failed to write completion ", message);
        // }
    }

}


// Shyguy — Today at 21:08
// this is the entrypoint for a script where i used it, its with TypeScript and React but the basic idea is the same https://github.com/shyguy1412/bitburner-ui-extension/blob/master/src/bitburner/bitburner-ui-extension.ts