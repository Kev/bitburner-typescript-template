/* eslint-disable @typescript-eslint/no-explicit-any */
import { CityName, CorpEmployeePosition, CorpMaterialName, CorpUpgradeName, CrimeType, NS, Server } from '@ns';
import { port_hacks, prepare_server, wait_for, find_servers, faction_servers } from './base';
export const function_sequence = [
  'cache_player',
  'world_end',
  'purchase_augmentations',
  'install_augmentations',
  'purchase_tor',
  'purchase_programs',
  'upgrade_home_ram',
  'purchase_servers',
  'upgrade_servers',
  'spread',
  'copy_scripts',
  'join_factions',
  'work_for_factions',
  'do_crime',
  'run_corporation',
  'choose_hack_server',
  'prepare_hack_server',
  'hack',
  'farm_hack_skill',
];
export const cities: Array<CityName> = ['Aevum' as CityName, 'Chongqing' as CityName, 'Ishima' as CityName, 'New Tokyo' as CityName, 'Sector-12' as CityName, 'Volhaven' as CityName];

// TODO: Add buying hacknet nodes for netburners

interface StateInt {
  purchased_tor: boolean;
  servers: Map<string, Server>;
  rooted: Array<string>;
  hack_server: string;
  completed_factions: Array<string>;
  joined_factions: Array<string>;
  hack_level: number;
  working_for: string;
  force_install: boolean;
  world: string;
  hack_server_iterations: number;
}

export class State {
  purchased_tor = false;
  servers: Map<string, Server> = new Map<string, Server>();
  rooted: Array<string> = [];
  hack_server = '';
  completed_factions: Array<string> = [];
  joined_factions: Array<string> = [];
  hack_level = 0;
  working_for = '';
  force_install = false;
  world = '';
  hack_server_iterations = 0;
}

function export_only(ns: NS, fn: string) {
  ns.write(`auto/only_${fn}.js`, `import {${fn}, get_state, export_state} from "./singularity"; /** @param {NS} ns */export async function main(ns) {
      ns.print("Running only ${fn}");const state = get_state(ns); await ${fn}(ns, state);export_state(ns, state);}`, 'w');
}

export function log(ns: NS, message: string) {
  ns.writePort(2, message);
  // ns.tprint(message);
}

export function make_scripts(ns: NS) {
  export_only(ns, 'make_scripts');
  for (let i = 0; i < function_sequence.length; i++) {
    const fn = function_sequence[i];
    const next_script = i + 1 < function_sequence.length ? `auto/${i + 1}.js` : 'auto/0.js';
    ns.write(`auto/${i}.js`, `import {${fn}, get_state, export_state, log} from "./singularity"; /** @param {NS} ns */export async function main(ns) {
      log(ns, "Running ${fn}");const state = get_state(ns); await ns.sleep(0); await ${fn}(ns, state);export_state(ns, state);ns.spawn('${next_script}', {threads : 1, spawnDelay: 1});}`, 'w');
    export_only(ns, fn);
  }
  const player = ns.getPlayer();
  const hack_level = player.skills.hacking;
  const state = get_state(ns);
  if (hack_level < state.hack_level) {
    // If hacking goes down, it means an install and things need calculating from scratch
    export_state(ns, new State());
  }
}

export function get_state(ns: NS): State {
  if (!ns.fileExists('auto/state.txt')) {
    return new State();
  }
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

export async function cache_player(ns: NS, state: State): Promise<void> {
  state.joined_factions = ns.getPlayer().factions;
  state.hack_level = ns.getPlayer().skills.hacking;
  state.world = `${ns.getResetInfo().currentNode}`;
}

export async function world_end(ns: NS, state: State): Promise<void> {
  if (!state.servers.has('w0r1d_d43m0n')) {
    return;
  }
  if (!can_hack_demon(ns, state)) {
    return;
  }
  const source_order = [[4, 3], [1, 3], [5, 3], [3, 1], [10, 1], [2, 1], [12, 3], [9, 3], [6, 1], [7, 1], [6, 3], [7, 3], [5, 3], [3, 3], [10, 3], [11, 3], [8, 3], [13, 3], [12, 99999999]];
  for (const source of source_order) {
    let found = false;
    let modifier = 0;
    if (state.world == `${source[0]}`) {
      modifier = 1;
    }
    for (const got of ns.singularity.getOwnedSourceFiles()) {
      if (got.n === source[0] && got.lvl + modifier >= source[1]) {
        found = true;
      }
    }
    if (!found) {
      ns.run("/destroy_world_demon.js", 1, source[0]);
      log(ns, `Running destroy_world_demon(${source[0]})`);
      await ns.sleep(100000000000);
    }
  }
}

const augs_before_install = 7;

function would_push_daedalus_into_favour(ns: NS): boolean {
  return ns.singularity.getFactionFavor('Daedalus') < 150 && ns.singularity.getFactionFavorGain('Daedalus') + ns.singularity.getFactionFavor('Daedalus') >= 150;
}

async function donate_to_faction(ns: NS, faction: string, amount: number): Promise<void> {
  await wait_for(ns, [ns.run('donate_to_faction.js', 1, faction, amount)]);
}

async function purchase_augmentation(ns: NS, faction: string, augment: string): Promise<boolean> {
  const old_count = ns.singularity.getOwnedAugmentations(true).length;
  await wait_for(ns, [ns.run('purchase_augmentation.js', 1, faction, augment)]);
  return old_count < ns.singularity.getOwnedAugmentations(true).length;
}

export async function purchase_augmentations(ns: NS, state: State): Promise<void> {
  let bought = true;
  while (bought) {
    const all_augs = ns.singularity.getOwnedAugmentations(true);
    const installed_augs = ns.singularity.getOwnedAugmentations(false);
    const candidates: Array<string> = [];
    const cash = ns.getServerMoneyAvailable('home');
    const factions = new Map<string, string>();
    const non_candidates = new Array<[string, string]>();
    const uninstalled_augs = all_augs.filter(aug => !installed_augs.includes(aug));
    let lots_of_nfg: string | undefined = undefined;
    let nfg_faction_rep = 0;
    let most_rep_with_favour = 0;
    let most_rep_with_favour_faction = '';
    const NFG = 'NeuroFlux Governor';
    // Loop so that if I bought something I can have another loop to buy higher tiers of the same aug
    bought = false;
    const lots = (10 - uninstalled_augs.length);
    const lots_rep_multiplier = (1.3 ** lots);
    for (const faction of state.joined_factions) {
      const highest_faction_requirements = ns.singularity.getAugmentationsFromFaction(faction).map(aug => ns.singularity.getAugmentationRepReq(aug)).reduce((a, b) => Math.max(a, b), 0);
      while ((ns.singularity.getFactionFavor(faction) > 150) && (ns.getServerMoneyAvailable('home') >= 10 ** 13) && (ns.singularity.getFactionRep(faction) < highest_faction_requirements)) {
        const amount = ns.getServerMoneyAvailable('home') / 10;
        await donate_to_faction(ns, faction, amount);
        await ns.sleep(0);
        log(ns, `Donated $${ns.formatNumber(amount)} to ${faction} aiming for ${ns.formatNumber(highest_faction_requirements)} rep (now ${ns.formatNumber(ns.singularity.getFactionRep(faction))}).`);
      }
      if (ns.singularity.getFactionRep(faction) > most_rep_with_favour && ns.singularity.getFactionFavor(faction) >= 150) {
        most_rep_with_favour = ns.singularity.getFactionRep(faction);
        most_rep_with_favour_faction = faction;
      }
      for (const augment of ns.singularity.getAugmentationsFromFaction(faction)) {
        if (!all_augs.includes(augment) && !candidates.includes(augment)) {
          if (ns.singularity.getAugmentationBasePrice(augment) <= cash && ns.singularity.getAugmentationRepReq(augment) <= ns.singularity.getFactionRep(faction)) {
            // TODO: If has cash but not rep, and has favour, donate to get rep
            candidates.push(augment);
            factions.set(augment, faction);
          } else {
            non_candidates.push([augment, faction]);
          }
        }
        if (augment === NFG) {
          // TODO: Is 1.3 good enough? No clue
          if (ns.singularity.getAugmentationPrice(augment) * lots <= cash && ns.singularity.getAugmentationRepReq(augment) * lots_rep_multiplier <= ns.singularity.getFactionRep(faction)) {
            if (ns.singularity.getFactionRep(faction) > nfg_faction_rep) {
              lots_of_nfg = faction;
              nfg_faction_rep = ns.singularity.getFactionRep(faction);
            }
          }
        }
      }
    }
    if (most_rep_with_favour_faction) {
      const needed_cash = ns.singularity.getAugmentationPrice(NFG) * lots;
      const needed_rep = ns.singularity.getAugmentationRepReq(NFG) * lots_rep_multiplier;
      while ((ns.getServerMoneyAvailable('home') >= 10 ** 13) && (needed_cash <= ns.getServerMoneyAvailable('home')) && (ns.singularity.getFactionRep(most_rep_with_favour_faction) < needed_rep)) {
        const amount = ns.getServerMoneyAvailable('home') / 100;
        await donate_to_faction(ns, most_rep_with_favour_faction, amount);
        log(ns, `Donated $${ns.formatNumber(amount)} to ${most_rep_with_favour_faction} based on estimate of $${ns.formatNumber(needed_cash)} and ${ns.formatNumber(needed_rep)} rep needed (now ${ns.formatNumber(ns.singularity.getFactionRep(most_rep_with_favour_faction))}).`);
        await ns.sleep(0);
      }
    }
    if (candidates.includes('BitWire') && candidates.includes('Synaptic Enhancement Implant') && candidates.includes('Cranial Signal Processors - Gen I') && ns.getServerMoneyAvailable('home') > 10 ** 8) {
      state.force_install = true;
    }
    if (state.force_install || candidates.length + uninstalled_augs.length > augs_before_install || lots_of_nfg || would_push_daedalus_into_favour(ns) || candidates.includes('The Red Pill')) {
      // Hold off installing any until we've got the rep and cash to buy enough, to avoid where I buy a cheap one and set the multiplier for ane expensive one
      candidates.sort((a, b) => ns.singularity.getAugmentationBasePrice(b) - ns.singularity.getAugmentationBasePrice(a));
      while (candidates.length > 0 && ns.singularity.getAugmentationPrice(candidates[0]) <= ns.getServerMoneyAvailable('home')) {
        const candidate = candidates.pop() || '';
        log(ns, `Buying ${candidate} from ${factions.get(candidate)}`);
        if (await purchase_augmentation(ns, factions.get(candidate) || '', candidate)) {
          bought = true;
        } else {
          log(ns, `Failed to buy ${candidate} from ${factions.get(candidate)}`);
        }
      }
      while (lots_of_nfg && ns.singularity.getAugmentationPrice(NFG) <= ns.getServerMoneyAvailable('home') && ns.singularity.getFactionRep(lots_of_nfg || '') >= ns.singularity.getAugmentationRepReq(NFG)) {
        log(ns, `Buying ${NFG} from ${lots_of_nfg}`);
        if (await purchase_augmentation(ns, lots_of_nfg || '', NFG)) {
          bought = true;
        } else {
          log(ns, `Failed to buy ${NFG} from ${lots_of_nfg}`);
        }
      }
    }
    ns.write('auto/augs.txt', JSON.stringify({ 'all_augs': all_augs, 'installed_augs': installed_augs, 'uninstalled_augs': uninstalled_augs, 'candidates': candidates, 'non_candidates': non_candidates }), 'w');
  }

  // TODO: Donate to factions to get rep where it would unlock further augs
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function install_augmentations(ns: NS, state: State): Promise<void> {
  const all_augs = ns.singularity.getOwnedAugmentations(true);
  const installed_augs = ns.singularity.getOwnedAugmentations(false);
  const uninstalled_augs = all_augs.filter(aug => !installed_augs.includes(aug));
  const uninstalled_nfg = all_augs.filter(aug => aug === 'NeuroFlux Governor').length;
  if (state.force_install || uninstalled_augs.length + uninstalled_nfg > augs_before_install || uninstalled_augs.includes('NeuroFlux Governor') || would_push_daedalus_into_favour(ns) || uninstalled_augs.includes('The Red Pill')) {
    state.force_install = false;
    if (ns.singularity.exportGameBonus()) {
      ns.singularity.exportGame();
    }
    ns.singularity.installAugmentations('auto.js');
  }
}

export async function purchase_tor(ns: NS, state: State): Promise<void> {
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function upgrade_home_ram(ns: NS, state: State): Promise<void> {
  if (ns.singularity.upgradeHomeRam()) {
    log(ns, `Upgraded home RAM to ${ns.formatRam(ns.getServerMaxRam('home'))}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function purchase_servers(ns: NS, state: State): Promise<void> {
  let i = 0;
  const initial_ram = 128;
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function upgrade_servers(ns: NS, state: State): Promise<void> {
  // Upgrade servers to 256G ASAP, 512G if hacks are unlocked, and beyond once formulas are unlocked
  const servers = ns.getPurchasedServers();
  let should_stop = false;
  while (!should_stop) {
    should_stop = true;
    for (const server of servers) {
      const current_ram = ns.getServerMaxRam(server);
      const upgrade_cost = ns.getPurchasedServerUpgradeCost(server, current_ram * 2);
      if (upgrade_cost > ns.getServerMoneyAvailable("home") * 0.1) {
        // Avoid spending all my money on servers early on, but if it's going to cost less than 10% of what I have, ignore these conditions.
        if (current_ram >= 256 && !port_hacks.every(program => ns.fileExists(program))) {
          continue;
        }
        if (!ns.fileExists('Formulas.exe') && current_ram >= 512) {
          continue;
        }
        if (ns.singularity.getOwnedAugmentations(false).length < 15 && current_ram >= 512 && ns.getServerMoneyAvailable("home") < 500000000) {
          continue;
        }
        if (ns.getHackingLevel() < 1000 && current_ram >= 2048) {
          continue;
        }
      }
      if (upgrade_cost < ns.getServerMoneyAvailable("home")) {
        log(ns, `Buying ${ns.formatRam(current_ram * 2)} for ${server}`);
        ns.upgradePurchasedServer(server, current_ram * 2);
        should_stop = false
      }
    }
  }
}

function faction_completed(ns: NS, state: State, faction: string): boolean {
  const augments = ns.singularity.getAugmentationsFromFaction(faction);
  const outliers = ['DataJack', 'Cranial Signal Processors - Gen III', 'Cranial Signal Processors - Gen II', // Implants that are much more expensive than others in money or rep, so it makes sense to move on to the next faction before unlocking
    'Neuroreceptor Management Implant', 'Speech Processor Implant', 'Nanofiber Weave', 'Wired Reflexes', 'Nuoptimal Nootropic Injector Implant', 'Speech Enhancement'  // Tian implants that I want to not delay me from moving on to the next faction for hack skills, even if the NMI I badly want to install later
  ];
  const remaining = augments.filter(aug => !ns.singularity.getOwnedAugmentations(true).includes(aug) && !outliers.includes(aug));
  return remaining.length === 0;
}

function faction_has_rep_to_complete(ns: NS, state: State, faction: string): boolean {
  const rep = ns.singularity.getFactionRep(faction);
  const augments = ns.singularity.getAugmentationsFromFaction(faction);
  const remaining = augments.filter(aug => !ns.singularity.getOwnedAugmentations(true).includes(aug));
  for (const aug of remaining) {
    if (ns.singularity.getAugmentationRepReq(aug) > rep) {
      return false;
    }
  }
  return true;
}

function in_one_of(state: State, factions: Array<string>): boolean {
  for (const faction of factions) {
    if (state.joined_factions.includes(faction)) {
      return true;
    }
  }
  return false;
}

function can_join(state: State, faction: string) {
  switch (faction) {
    case 'Sector-12': return !in_one_of(state, ['New Tokyo', 'Chongqing', 'Ishima', 'Volhaven']);
    case 'New Tokyo': return !in_one_of(state, ['Sector-12', 'Aevum', 'Volhaven']);
    case 'Chongqing': return !in_one_of(state, ['Sector-12', 'Aevum', 'Volhaven']);
    case 'Ishima': return !in_one_of(state, ['Sector-12', 'Aevum', 'Volhaven']);
    case 'Aevum': return !in_one_of(state, ['New Tokyo', 'Chongqing', 'Ishima', 'Volhaven']);
    case 'Volhaven': return !in_one_of(state, ['Sector-12', 'New Tokyo', 'Chongqing', 'Ishima', 'Aevum']);
  }
  return true;
}

export async function join_factions(ns: NS, state: State): Promise<void> {
  const cities: Array<"New Tokyo" | "Chongqing" | "Sector-12" | "Aevum" | "Ishima" | "Volhaven"> = ['New Tokyo', 'Chongqing', 'Sector-12', 'Aevum', 'Ishima', 'Volhaven']
  const cities_string: Array<string> = cities.map(city => city);
  if (!faction_completed(ns, state, 'Tian Di Hui') && !state.joined_factions.includes('Tian Di Hui')) {
    ns.singularity.travelToCity('Chongqing');
  } else for (const faction of cities) {
    if (!faction_completed(ns, state, faction) && !state.joined_factions.includes(faction) && can_join(state, faction)) {
      ns.singularity.travelToCity(faction);
      break;
    }
  }

  // All factions that should be autojoined, join
  for (const faction of ns.singularity.checkFactionInvitations()) {
    if (cities_string.includes(faction) && faction_completed(ns, state, faction)) {
      continue;
    }
    ns.singularity.joinFaction(faction);
    state.joined_factions.push(faction);
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
  const paths = new Map<string, Array<string>>();
  paths.set('home', ['home']);
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

    if (!server.backdoorInstalled && (server.requiredHackingSkill || 999999999999999) < ns.getHackingLevel() && faction_servers.includes(host)) {
      for (const part of paths.get(host) || []) {
        ns.singularity.connect(part);
      }
      await ns.singularity.installBackdoor();
      for (const part of paths.get(host)?.reverse() || []) {
        ns.singularity.connect(part);
      }

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
          paths.set(adjacent, [...paths.get(host) || [], adjacent]);
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

  // TODO: Instead of prioritising factions, prioritise implants, and work for the faction that has the highest priority implant
  const faction_priorities = ['NiteSec', 'Tian Di Hui', 'The Black Hand', 'Chongqing', 'BitRunners', 'Daedalus', 'Sector-12', 'Aevum', 'Volhaven', 'Ishima', 'New Tokyo'];
  for (const faction of faction_priorities) {
    if (!faction_completed(ns, state, faction) && !faction_has_rep_to_complete(ns, state, faction) && state.joined_factions.includes(faction) && ns.singularity.getFactionFavor(faction) < 150) {
      if (state.working_for === faction) {
        break;
      }
      state.working_for = faction;
      ns.singularity.workForFaction(faction, 'hacking');
      if (ns.singularity.getOwnedAugmentations(false).includes('Neuroreceptor Management Implant')) {
        // If I have this implant, no need to focus any more, and focus is annoying if I want to click in the UI.
        ns.singularity.setFocus(false);
      }
      break;
    }
  }
}

export async function do_crime(ns: NS, state: State): Promise<void> {
  if (ns.singularity.isBusy() && (state.rooted.includes('wondersheep-24') || ns.getHackingLevel() > 200)) {
    return;
  }
  // If I'm not already doing something for a faction, do some crime
  const chosen_crimes: Array<"Larceny" | "Mug" | "Rob Store" | CrimeType | "Shoplift" | "Deal Drugs" | "Bond Forgery" | "Traffick Arms" | "Homicide" | "Grand Theft Auto" | "Kidnap" | "Assassination" | "Heist"> = ['Larceny', 'Mug', 'Rob Store', 'Shoplift'];
  // If I couldn't afford to buy all the servers yet, or I'm not already doing something for a faction, do some crime
  for (const crime of chosen_crimes) {
    if (ns.singularity.getCrimeChance(crime) > 0.5) {
      ns.singularity.commitCrime(crime);
      state.working_for = '';
      return;
    }
  }
  if (!ns.singularity.isBusy() || !state.working_for) {
    ns.singularity.commitCrime('Shoplift');
  }
}

export async function copy_scripts(ns: NS, state: State): Promise<void> {
  // Copy scripts to all servers
  for (const server_name of state.rooted.filter(server_name => server_name != 'home')) {
    for (const script of ['just_hack.js', 'just_weaken.js', 'just_grow.js', 'once.js', 'hack_once.js', 'weaken_once.js', 'grow_once.js', 'base.js', 'singularity.js']) {
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

  if (state.hack_server === '' || state.hack_server === best || state.hack_server_iterations > 10) {
    if (state.hack_server !== best) {
      state.hack_server_iterations = 0;
    }
    state.hack_server = best;
  }
  state.hack_server_iterations++;
  log(ns, `Chose ${best} as hack server with ${ns.getHackingLevel()} hacking level, running against ${state.hack_server} for the ${state.hack_server_iterations}th time.`);
}

export async function prepare_hack_server(ns: NS, state: State): Promise<void> {
  await prepare_server(ns, state.hack_server, true);
}


// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function hack(ns: NS, state: State): Promise<void> {
  // if (can_hack_demon(ns, state)) {
  //   return;
  // }
  await wait_for(ns, [ns.run('batcher.js', 1)]);
}

function can_hack_demon(ns: NS, state: State): boolean {
  if (!state.servers.has('w0r1d_d43m0n')) {
    return false;
  }
  log(ns, `Needed skill to hack daemon ${ns.getServerRequiredHackingLevel('w0r1d_d43m0n') * ns.getBitNodeMultipliers().WorldDaemonDifficulty} and I have ${ns.getHackingLevel()}`);
  return ns.getServerRequiredHackingLevel('w0r1d_d43m0n') * ns.getBitNodeMultipliers().WorldDaemonDifficulty <= ns.getHackingLevel();
}

export async function farm_hack_skill(ns: NS, state: State): Promise<void> {
  ns.disableLog("ALL");
  const start = Date.now();
  // TODO: Any server that's too small to batch on (less than 256GB?), as long as at least one server *is* big enough to batch on, farm skill on
  while (state.servers.has('w0r1d_d41m0n') && Date.now() - start < 1000 * 60 * 15 && !can_hack_demon(ns, state)) {
    await prepare_server(ns, 'joesguns');
    const pids: Array<number> = [];
    for (const server of state.rooted) {
      const ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
      const script_ram = ns.getScriptRam('just_grow.js', server);
      const threads = Math.floor(ram / script_ram);
      if (threads > 0) {
        pids.push(ns.exec('just_grow.js', server, { threads: threads, temporary: true }, 'joesguns'));
      }
    }
    if (pids.length === 0) {
      return;
    }
    await wait_for(ns, pids);
  }
}

function buy_up_to(ns: NS, division: string, amounts: Map<CorpMaterialName, number>): boolean {
  for (const city of cities) {
    for (const material of amounts.keys()) {
      const mat_data = ns.corporation.getMaterial("Agriculture", city, material);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const desired = amounts.get(material)!;
      if (mat_data.stored < desired) {
        if (mat_data.marketPrice * (desired - mat_data.stored) > ns.corporation.getCorporation().funds) {
          return false;
        }
        ns.corporation.buyMaterial("Agriculture", city, material, desired - mat_data.stored);
      }
    }
  }
  return true;
}

function employees_ready(ns: NS, division: string): boolean {
  for (const city of cities) {
    if (ns.corporation.getOffice(division, city).avgMorale < 90 || ns.corporation.getOffice(division, city).avgEnergy < 90) {
      return false;
    }
  }
  return true;

}

function hire_up_to(ns: NS, division: string, amounts: Map<CorpEmployeePosition, number>): boolean {
  for (const city of cities) {
    for (const position of amounts.keys()) {
      const desired = amounts.get(position) || 0;
      while (ns.corporation.getOffice(division, city).employeeJobs[position] < desired) {
        if (ns.corporation.getOffice(division, city).size == ns.corporation.getOffice(division, city).numEmployees) {
          ns.corporation.upgradeOfficeSize(division, city, 3);
        }
        if (!ns.corporation.hireEmployee(division, city, position)) {
          return false;
        }
      }
    }
  }
  return true;
}

function warehouse_up_to(ns: NS, division: string, size: number): boolean {
  for (const city of cities) {
    const amount = size - ns.corporation.getWarehouse(division, city).size;
    if (amount > 0) {
      if (ns.corporation.getUpgradeWarehouseCost(division, city, amount) > ns.corporation.getCorporation().funds) {
        return false;
      }
      ns.corporation.upgradeWarehouse(division, city, amount);
    }
  }
  return true;

}

export async function run_corporation(ns: NS, state: State): Promise<void> {
  if (!ns.corporation.hasCorporation()) {
    // If we can self fund, do so, else attempt to use the BN3 feature to fund
    if (!ns.corporation.createCorporation("wondersheepcorp", true)) {
      ns.corporation.createCorporation("wondersheepcorp", false);
    }
  }
  if (!ns.corporation.hasCorporation()) {
    return;
  }
  if (!ns.corporation.getCorporation().divisions.includes('Agriculture')) {
    // Set a basic level of income that (I think) I should be able to afford after creating the corporation
    ns.corporation.expandIndustry('Agriculture', 'Agriculture');
    ns.corporation.purchaseUnlock('Smart Supply');
    for (const city of cities) {
      if (!ns.corporation.getDivision('Agriculture').cities.includes(city)) {
        ns.corporation.expandCity('Agriculture', city);
      }
      if (!ns.corporation.hasWarehouse('Agriculture', city)) {
        ns.corporation.purchaseWarehouse('Agriculture', city);
        ns.corporation.upgradeWarehouse('Agriculture', city, 2);
      }
      const jobs = ns.corporation.getOffice('Agriculture', city).employeeJobs;
      const single_positions = ['Operations' as CorpEmployeePosition, 'Engineer' as CorpEmployeePosition, 'Business' as CorpEmployeePosition];
      for (const position of single_positions) {
        if (jobs[position] < 1) {
          if (ns.corporation.getOffice('Agriculture', city).size == ns.corporation.getOffice('Agriculture', city).numEmployees) {
            ns.corporation.upgradeOfficeSize('Agriculture', city, 3);
          }
          ns.corporation.hireEmployee('Agriculture', city, position);
        }
      }
      ns.corporation.getMaterial('Agriculture', city, 'Food').desiredSellAmount = "MAX";
      ns.corporation.getMaterial('Agriculture', city, 'Food').desiredSellPrice = "MP";
      ns.corporation.setSmartSupply('Agriculture', city, true);
    }
    ns.corporation.hireAdVert('Agriculture');
  }

  // At this point, I should have a corporation, and it should be set up to be self funding, so I can slowly upgrade as funds are available
  const first_upgrades: CorpUpgradeName[] = ['FocusWires', 'Neural Accelerators', 'Speech Processor Implants', 'Nuoptimal Nootropic Injector Implants', 'Smart Factories'];
  for (const level of [1, 2]) {
    for (const upgrade of first_upgrades) {
      if (ns.corporation.getUpgradeLevel(upgrade) < level) {
        if (ns.corporation.getUpgradeLevelCost(upgrade) > ns.corporation.getCorporation().funds) {
          return;
        }
        ns.corporation.levelUpgrade(upgrade);
      }
    }
  }

  if (!buy_up_to(ns, 'Agriculture', new Map<CorpMaterialName, number>([['Hardware' as CorpMaterialName, 125], ['AI Cores' as CorpMaterialName, 75], ['Real Estate' as CorpMaterialName, 27000]]))) {
    return;
  }

  if (!employees_ready(ns, 'Agriculture')) {
    return;
  }

  if (!hire_up_to(ns, 'Agriculture', new Map<CorpEmployeePosition, number>([['Operations' as CorpEmployeePosition, 2], ['Engineer' as CorpEmployeePosition, 2], ['Business' as CorpEmployeePosition, 1], ['Management' as CorpEmployeePosition, 2], ['Research & Development' as CorpEmployeePosition, 2], ['Intern' as CorpEmployeePosition, 2]]))) {
    return;
  }

  if (!warehouse_up_to(ns, 'Agriculture', 10)) {
    return;
  }

  if (!buy_up_to(ns, 'Agriculture', new Map<CorpMaterialName, number>([['Hardware' as CorpMaterialName, 2800], ['Robots', 96], ['AI Cores' as CorpMaterialName, 2520], ['Real Estate' as CorpMaterialName, 146400]]))) {
    return;
  }

  if (!warehouse_up_to(ns, 'Agriculture', 20)) {
    return;
  }

  if (!buy_up_to(ns, 'Agriculture', new Map<CorpMaterialName, number>([['Hardware' as CorpMaterialName, 9300], ['Robots', 726], ['AI Cores' as CorpMaterialName, 6270], ['Real Estate' as CorpMaterialName, 230400]]))) {
    return;
  }
}