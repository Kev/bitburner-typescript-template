import { NS } from '@ns'

function string_in(s: string, a: Array<string>) {
    for (const i of a) {
        if (s == i) {
            return true;
        }
    }
    return false;
}

class MyNetwork {
    rooted: Array<string> = ['home'];
    target = 'n00dles';
}

async function farm_out(ns: NS, network: MyNetwork, script: string, threads: number, ...args: Array<string>): Promise<number[]> {
    ns.print("Farming out ", script, " with ", threads, " threads, args: ", args.join(", "));
    if (threads == 0) return [];
    for (const server of network.rooted) {
        ns.scp(script, server);
    }
    const pids: Array<number> = [];
    while (threads > 0) {
        const servers = [...network.rooted];
        while (threads > 0 && servers.length > 0) {
            const server = servers.pop() || '';
            const server_ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
            const script_ram = ns.getScriptRam(script, server);
            const threads_to_use = Math.min(threads, Math.floor(server_ram / script_ram));
            if (threads_to_use == 0) {
                continue;
            }
            ns.print("    Using ", threads_to_use, " threads on ", server, " at a RAM cost of ", ns.formatRam(threads_to_use * script_ram));
            pids.push(await ns.exec(script, server, threads_to_use, ...args));
            threads -= threads_to_use;
        }
        await ns.sleep(100);
        if (!Number.isFinite(threads)) {
            break;
        }
    }
    return pids;
}


async function wait_for(ns: NS, pids: Array<number>) {
    ns.print("  Waiting for ", pids.length, " processes to finish.");
    while (pids.length > 0) {
        const pid = pids.pop() || 0;
        while (ns.isRunning(pid)) {
            await ns.sleep(100);
        }
    }
}

async function prepare_server(ns: NS, network: MyNetwork) {
    ns.print("Preparing server ", network.target);
    const target = network.target;
    const excess_security = ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target);
    const weaken_security = 0.05;
    const weakens_needed = Math.ceil(excess_security / weaken_security);
    ns.print("Weakening ", weakens_needed, " times for ", excess_security, " excess security");
    await wait_for(ns, await farm_out(ns, network, 'weaken_once.js', weakens_needed, target));
    const current_money = ns.getServerMoneyAvailable(target);
    const max_money = ns.getServerMaxMoney(target);
    const grow_proportion = current_money >= max_money ? 0 : max_money / current_money;
    ns.print("Current money is ", current_money, " and max money is ", max_money, " so grow proportion is ", grow_proportion);
    if (grow_proportion > 0) {
        if (!isFinite(grow_proportion)) {
            ns.print("Found an infinite grow proportion, so doing a max run of growth and then running prepare again");
            await wait_for(ns, await farm_out(ns, network, 'grow_once.js', Infinity, target));
            ns.print("  Pre-growth complete, starting preparation again");
            await ns.sleep(10);
            await prepare_server(ns, network);
            return;
        }
        const grow_threads = Math.ceil(ns.growthAnalyze(target, grow_proportion));
        const grow_security = ns.growthAnalyzeSecurity(grow_threads, target);
        const security_threads = Math.ceil(grow_security / weaken_security);
        ns.print("Growing ", grow_threads, " times for ", grow_proportion, " growth (", max_money - current_money, " short)");
        const grow_pids = await farm_out(ns, network, 'grow_once.js', grow_threads, target);
        ns.print("Weakening ", security_threads, " times for ", grow_security, " security, with predicted effect ", ns.weakenAnalyze(security_threads));
        const security_pids = await farm_out(ns, network, 'weaken_once.js', security_threads, target);
        await wait_for(ns, grow_pids);
        await wait_for(ns, security_pids);
    }
}

async function find_network(ns: NS): Promise<MyNetwork> {
    const network = new MyNetwork();
    const to_scan: Array<string> = ['home'];
    const scanned: Array<string> = [];
    while (to_scan.length > 0) {
        const host: string = to_scan.pop() || '';
        const adjacents: Array<string> = await ns.scan(host);
        scanned.push(host);
        for (const adjacent of adjacents) {
            if (string_in(adjacent, scanned)) {
                continue;
            }
            if (ns.hasRootAccess(adjacent) && !(string_in(adjacent, network.rooted))) {
                network.rooted.push(adjacent);
                to_scan.push(adjacent);
            }
        }
    }
    network.target = ns.getHackingLevel() >= 170 ? 'phantasy' : (ns.getHackingLevel() >= 20 ? 'joesguns' : 'n00dles');
    return network;
}

function print_state(ns: NS, network: MyNetwork) {
    ns.print("Security is ", ns.getServerSecurityLevel(network.target), "/", ns.getServerMinSecurityLevel(network.target), " and money is ", ns.getServerMoneyAvailable(network.target), "/", ns.getServerMaxMoney(network.target));
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');

    const network = await find_network(ns);
    ns.print("Server to target: ", network.target);
    print_state(ns, network);
    await prepare_server(ns, network);
    print_state(ns, network);


    const twenty_percent = ns.getServerMaxMoney(network.target) * 0.2;
    const full_hack_threads = Math.floor(ns.hackAnalyzeThreads(network.target, twenty_percent));
    const hack_security_increase = ns.hackAnalyzeSecurity(full_hack_threads, network.target);
    const full_hack_weaken_threads = Math.ceil(hack_security_increase / 0.05) + 1; // +1 in case of float rounding errors
    const hack_pids = await farm_out(ns, network, 'hack_once.js', full_hack_threads, network.target);
    const hack_security_pids = await farm_out(ns, network, 'weaken_once.js', full_hack_weaken_threads, network.target);
    await wait_for(ns, hack_pids);
    await wait_for(ns, hack_security_pids);
    ns.print("After executing initial hack threads, security is ", ns.getServerSecurityLevel(network.target), " and money is ", ns.getServerMoneyAvailable(network.target));

    const full_grow_threads = Math.ceil(ns.growthAnalyze(network.target, 1.25)) + 1; // Just adding 1 in case of float rounding errors
    const grow_security_increase = ns.growthAnalyzeSecurity(full_grow_threads, network.target);
    const full_grow_weaken_threads = Math.ceil(grow_security_increase / 0.05) + 1; // +1 in case of float rounding errors
    const grow_pids = await farm_out(ns, network, 'grow_once.js', full_grow_threads, network.target);
    const grow_security_pids = await farm_out(ns, network, 'weaken_once.js', full_grow_weaken_threads, network.target);
    await wait_for(ns, grow_pids);
    await wait_for(ns, grow_security_pids);
    ns.print("After executing initial grow threads, security is ", ns.getServerSecurityLevel(network.target), " and money is ", ns.getServerMoneyAvailable(network.target));



    ns.print("Starting loop hack with threads: H", full_hack_threads, " W", full_hack_weaken_threads, " G", full_grow_threads, " W", full_grow_weaken_threads, " against ", network.target);
    let did_something = true;
    for (; ;) {
        if (did_something) print_state(ns, network);
        did_something = false;
        const rooted = [...network.rooted];
        while (rooted.length > 0) {
            const server = rooted.pop() || '';
            const server_used_ram = ns.getServerUsedRam(server);
            const server_max_ram = ns.getServerMaxRam(server);
            const grow_time = ns.getGrowTime(network.target);
            const hack_time = ns.getHackTime(network.target);
            const weaken_time = ns.getWeakenTime(network.target);
            const server_ram = server_max_ram - server_used_ram;
            const needed_ram = ns.getScriptRam('hack_once.js', server) * full_hack_threads + ns.getScriptRam('weaken_once.js', server) * (full_hack_weaken_threads + full_grow_weaken_threads) + ns.getScriptRam('grow_once.js', server) * full_grow_threads;
            if (server_ram < needed_ram && server_used_ram > 0) {
                // Skip servers that can't fit a full batch in, unless they're empty, in which case assign a partial batch to max the RAM
                continue;
            }
            const proportion = Math.min(1, server_ram / needed_ram);
            const hack_threads = Math.floor(full_hack_threads * proportion);
            const hack_weaken_threads = Math.floor(full_hack_weaken_threads * proportion);
            const grow_threads = Math.floor(full_grow_threads * proportion);
            const grow_weaken_threads = Math.floor(full_grow_weaken_threads * proportion);
            if (hack_threads > 0 && hack_weaken_threads > 0 && grow_threads > 0 && grow_weaken_threads > 0) {
                // Else There wasn't enough RAM to run even the smallest possible batch, skip
                did_something = true;
                ns.print("    Using server ", server, " with threads: H", hack_threads, " W", hack_weaken_threads, " G", grow_threads, " W", grow_weaken_threads);

                const hack_delay = weaken_time - hack_time;
                const grow_delay = weaken_time - grow_time;
                await ns.exec('hack_once.js', server, hack_threads, network.target, hack_delay);
                await ns.exec('weaken_once.js', server, hack_weaken_threads, network.target, 1);
                await ns.exec('grow_once.js', server, grow_threads, network.target, grow_delay + 2);
                await ns.exec('weaken_once.js', server, grow_weaken_threads, network.target, 3);
            }
            await ns.sleep(5);
        }
        await ns.sleep(50);
    }

}





