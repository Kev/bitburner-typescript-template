/* eslint-disable @typescript-eslint/no-explicit-any */
import { NS, Server } from '@ns';
import { port_hacks, hack_security, prepare_server, wait_for, find_servers } from './base';
export const function_sequence = [
  'world_end',
  'purchase_augmentations',
  'install_augmentations',
  'purchase_tor',
  'purchase_programs',
  'upgrade_home_ram',
  'purchase_servers',
  'upgrade_servers',
  'join_factions',
  'spread',
  'work_for_factions',
  'do_crime',
  'choose_hack_server',
  'prepare_hack_server',
  'hack',
];

// TODO: Add buying hacknet nodes for netburners

interface StateInt {
  purchased_tor: boolean;
  servers: Map<string, Server>;
  rooted: Array<string>;
  hack_server: string;
}

export class State {
  purchased_tor = false;
  servers: Map<string, Server> = new Map<string, Server>();
  rooted: Array<string> = [];
  hack_server = '';
}

function export_only(ns: NS, fn: string) {
  ns.write(`auto/only_${fn}.js`, `import {${fn}, get_state, export_state} from "./singularity"; /** @param {NS} ns */export async function main(ns) {
      ns.print("Running only ${fn}");const state = get_state(ns); await ${fn}(ns, state);export_state(ns, state);}`, 'w');
}

export function log(ns: NS, message: string) {
  ns.writePort(2, message);
}

export function make_scripts(ns: NS) {
  export_state(ns, {
    purchased_tor: false,
    servers: new Map<string, Server>(),
    rooted: [],
    hack_server: ''
  });
  export_only(ns, 'make_scripts');
  for (let i = 0; i < function_sequence.length; i++) {
    const fn = function_sequence[i];
        const next_script = i + 1 < function_sequence.length ? `auto/${i + 1}.js` : 'auto/0.js';
    ns.write(`auto/${i}.js`, `import {${fn}, get_state, export_state, log} from "./singularity"; /** @param {NS} ns */export async function main(ns) {
      log(ns, "Running ${fn}");const state = get_state(ns); await ns.sleep(0); await ${fn}(ns, state);export_state(ns, state);ns.spawn('${next_script}', {threads : 1, spawnDelay: 1});}`, 'w');
    export_only(ns, fn);
  }
}

export function get_state(ns: NS): State {
  const json = JSON.parse(ns.read('auto/state.txt'));
  const state_int = json as StateInt;
  const state: State = state_int;
  state.servers = new Map<string, Server>(Object.entries(json['servers']));

  return state;
}

export function export_state(ns: NS, state: State) {
  const servers = state.servers;
  // Go through this dance because Map gets silently converted to an empty object,
  // And I'm not JS/TS-smart enough to fix that in a cleaner way.
  const copied_state = JSON.parse(JSON.stringify(state));
  copied_state['servers'] = Object.fromEntries(servers);
  const str = JSON.stringify(copied_state);
  ns.write('auto/state.txt', str, 'w');
}

export async function world_end(ns: NS, state: State): Promise<void> {
  // TODO
}

export async function purchase_augmentations(ns: NS, state: State): Promise<void> {
  // TODO
}

export async function install_augmentations(ns: NS, state: State): Promise<void> {
  // TODO
}

export async function purchase_tor(ns: NS, state: State): Promise<void> {
  if (state.purchased_tor) return;
  if (ns.singularity.purchaseTor()) {
    state.purchased_tor = true;
    log(ns, "Purchased Tor");
  }
}

export async function purchase_programs(ns: NS, state: State): Promise<void> {
  if (!state.purchased_tor) return;
  for (const program of port_hacks) {
    if (!ns.fileExists(program)) {
      const cost = ns.singularity.getDarkwebProgramCost(program);
      if (cost <= ns.getServerMoneyAvailable('home')) {
        ns.singularity.purchaseProgram(program);
        log(ns, `Purchased  ${program}`);
      }
    }
  }
}

export async function upgrade_home_ram(ns: NS, state: State): Promise<void> {
  if (ns.singularity.upgradeHomeRam()) {
    log(ns, `Upgraded home RAM to ${ns.formatRam(ns.getServerMaxRam('home'))}`);
  }
}

export async function purchase_servers(ns: NS, state: State): Promise<void> {
  let i = 0;
  const initial_ram = 256;
  while (i < 25) {
    const name: string = "wondersheep-" + i;
    ++i;
    if (ns.serverExists(name)) {
      continue;
    }
    const cash = ns.getServerMoneyAvailable("home");
    const cost = ns.getPurchasedServerCost(initial_ram);
    if (cash > cost) {
      log(ns, `Purchasing ${name}`);
      ns.purchaseServer(name, initial_ram);
    }
  }
}

export async function upgrade_servers(ns: NS, state: State): Promise<void> {
  // Upgrade servers to 512G if hacks are unlocked, and beyond once formulas are unlocked
  if (!port_hacks.every(program => ns.fileExists(program))) {
    return;
  }
  const servers = ns.getPurchasedServers();
  let should_stop = false;
  while (!should_stop) {
    should_stop = true;
    for (const server of servers) {
      const current_ram = ns.getServerMaxRam(server);
      const upgrade_cost = ns.getPurchasedServerUpgradeCost(server, current_ram * 2);
      if (!ns.fileExists('Formulas.exe') && current_ram >= 512) {
        continue;
      }
      if (upgrade_cost < ns.getServerMoneyAvailable("home")) {
        log(ns, `Buying ${ns.formatRam(current_ram * 2)} for ${server}`);
        ns.upgradePurchasedServer(server, current_ram * 2);
        should_stop = false
      }
    }
  }
}

export async function join_factions(ns: NS, state: State): Promise<void> {
  // All factions that should be autojoined, join
  for (const faction of ns.singularity.checkFactionInvitations()) {
    ns.singularity.joinFaction(faction);
    log(ns, `Joined ${faction}`);
  }
  // TODO before this, travel to an appropriate city based on needing Tian Di Hui, or city factions
}

export async function spread(ns: NS, state: State): Promise<void> {
  // Spread to all hackable servers, backdooring where possible, and recording the known servers in state
  const to_scan: Array<string> = ['home'];
  state.servers.clear();
  const available_port_hacks: Array<string> = port_hacks.filter(port_hack => ns.fileExists(port_hack))
  const num_ports_possible: number = available_port_hacks.length;
  let i = 0;
  while (to_scan.length > 0) {
    i++;
    if (i > 10000) {
      // Something has gone terribly wrong
      await ns.sleep(1000);
    }
    const host: string = to_scan.pop() || '';
    if (state.servers.has(host)) {
      continue;
    }
    const server = ns.getServer(host);
    state.servers.set(host, server);
    const adjacents: Array<string> = ns.scan(host);

    if (!server.backdoorInstalled) {
      // await ns.singularity.installBackdoor();
      // TODO: Install backdoors
    }

    for (const adjacent of adjacents) {
      if (state.servers.has(adjacent)) {
        continue;
      }
      if (!ns.hasRootAccess(adjacent)) {
        if (ns.getServerRequiredHackingLevel(adjacent) <= ns.getHackingLevel() && ns.getServerNumPortsRequired(adjacent) <= num_ports_possible) {
          if (ns.fileExists('BruteSSH.exe')) {
            ns.brutessh(adjacent);
          }
          if (ns.fileExists('FTPCrack.exe')) {
            ns.ftpcrack(adjacent);
          }
          if (ns.fileExists('relaySMTP.exe')) {
            ns.relaysmtp(adjacent);
          }
          if (ns.fileExists('HTTPWorm.exe')) {
            ns.httpworm(adjacent);
          }
          if (ns.fileExists('SQLInject.exe')) {
            ns.sqlinject(adjacent);
          }
          ns.nuke(adjacent);
        }
      }
      if (ns.hasRootAccess(adjacent)) {
        if (!(adjacent in to_scan)) {
          to_scan.push(adjacent);
        }
      } else {
        state.servers.set(adjacent, ns.getServer(adjacent));
      }
    }
    await ns.sleep(0);
  }
  state.rooted = [...state.servers.keys()].filter(server => ns.hasRootAccess(server));
  log(ns, `After spreading,  ${state.servers.size} servers`);
  find_servers(ns); // TODO: Clear this out and avoid calling functions that need it
}

export async function work_for_factions(ns: NS, state: State): Promise<void> {
  // Pick the best faction to work on, work
  // TODO
}

export async function do_crime(ns: NS, state: State): Promise<void> {
  // If I'm not already doing something for a faction, do some crime
  // TODO
}

export async function copy_scripts(ns: NS, state: State): Promise<void> {
  // Copy scripts to all servers
  for (const server_name of state.rooted.filter(server_name => server_name != 'home')) {
    for (const script of ['just_hack.js', 'just_weaken.js', 'just_grow.js', 'once.js']) {
      ns.scp(script, server_name);
    }
  }
}

export async function choose_hack_server(ns: NS, state: State): Promise<void> {
  const hacking_level = ns.getHackingLevel();
  let best = 'n00dles';
  if (hacking_level > 600) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const servers = [...state.servers.keys()].filter(server_name => { const server = state.servers.get(server_name)!; return server.hasAdminRights && !server.purchasedByPlayer });
    servers.sort((a, b) => {
      const a_chance = ns.hackAnalyzeChance(a);
      const b_chance = ns.hackAnalyzeChance(b);
      const a_amount = ns.hackAnalyze(a);
      const b_amount = ns.hackAnalyze(b);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const a_server = state.servers.get(a)!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const b_server = state.servers.get(b)!;
      const a_max = a_server.moneyMax || 0;
      const b_max = b_server.moneyMax || 0;
      const a_score = a_chance * a_amount * a_max;
      const b_score = b_chance * b_amount * b_max;
      return b_score - a_score;
    });
    best = servers[0];
  } else {
    if (hacking_level >= 200 && ns.hasRootAccess('phantasy')) {
      best = 'phantasy';
    } else if (hacking_level >= 20 && ns.hasRootAccess('joesguns')) {
      best = 'joesguns';
    } else {
      best = 'n00dles';
    }
  }
  state.hack_server = best;
  log(ns, `Chose ${best} as hack server with ${ns.getHackingLevel()} hacking level`);
}

export async function prepare_hack_server(ns: NS, state: State): Promise<void> {
  await prepare_server(ns, state.hack_server, true);
}


export async function hack(ns: NS, state: State): Promise<void> {
  await wait_for(ns, [ns.run('batcher.js', 1)]);
}
