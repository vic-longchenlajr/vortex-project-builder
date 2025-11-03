/**
 * @description Contains all of the partcodes used within both estimator tools
 * Includes area for exceptions: partcodes may be added as well as corresponding prices
 * and descriptions
 */
// ---- Shared tuple type for all part codes ----
export type Codes = Readonly<[bpcs: string, m3: string]>;

/** Helper to define codes with type safety */
const pc = (bpcs: string, m3: string): Codes => [bpcs, m3] as const;

// transducers
export const __transducer_exp: Codes = pc("P000951TRM", "D09510000VXTRVP");
export const __transducer_nor: Codes = pc("P000951134", "D09510000VXPT0D");

// release valves
export const __pilot_primary_80L: Codes = pc("S0009500PP", "D09500000VXPPK0");
export const __pilot_secondary_80L: Codes = pc("S0009500SP", "D09500000VX00SP");
export const __pilot_secondary_80L_p: Codes = pc(
  "S000950PSP",
  "D09500000VXSPPG"
);
export const __pilot_primary_49L: Codes = pc("S4909500PP", "D095000000VX4P0");
export const __pilot_secondary_49L: Codes = pc("S4909500SP", "D095000049VX4S0");

// refill adapters
export const __refill_cga580: Codes = pc("S002950000", "D09500000VXT0A5");
export const __refill_cga677: Codes = pc("S002950401", "D0950000VXTA00A");

// signage
export const __warning_inside: Codes = pc("Z111278LBL", "ZL1127800000000");
export const __warning_outside: Codes = pc("Z111277LBL", "ZL1127700000000");

export const __placard_manual: Codes = pc("Z000950004", "ZL0497600000000");
export const __placard_rack: Codes = pc("Z000950030", "ZL0663600000000");

export const __placard_int_zone: Codes = pc("Z000950011", "ZL0552200000000");
export const __placard_ext_zone: Codes = pc("Z000950012", "ZL0552300000000");

// design method labels
export const __vortex_spec_hazards: Codes = pc("Z519892LBL", "ZL1989200000000");
export const __vortex_data_proc_pe: Codes = pc("Z521073LBL", "ZL2107300000000");
export const __vortex_data_proc: Codes = pc("Z519889LBL", "ZL1988900000000");
export const __vortex_comb_turb: Codes = pc("Z519890LBL", "ZL1989000000000");
export const __vortex_wet_benches: Codes = pc("Z519891LBL", "ZL1989100000000");

// hoses
export const __refill_bulk: Codes = pc("S000950015", "D09500000VX0MFA");
export const __flexible_hose: Codes = pc("A480AQBH2V", "AGH1C0480ZZBIFV");

// emitter options
export const __1_emitter_dom_es: Codes = pc("S010953511", "D09530010VXE0DF");
export const __1_emitter_dom_ss: Codes = pc("S010953501", "D09530010VXESDF");
export const __58_emitter_cav_ss: Codes = pc("S005953006", "D09540005VXESDF");
export const __58_emitter_cav_sp: Codes = pc("S006953503", "D09530005VXCVE0");
export const __58_emitter_cav_es: Codes = pc("S006953512", "D09530005VXE0CF");
export const __38_emitter_cav_ss: Codes = pc("S003953001", "D09540003VXE0CF");
export const __38_emitter_cav_es: Codes = pc("S003953031", "D09530003VXE0CF");
export const __12_emitter_dom_ss: Codes = pc("S000953510", "D09530004VXEXDF");
export const __12_emitter_dom_sp: Codes = pc("S006953406", "D09530006VXE0N0");
export const __12_emitter_dom_es: Codes = pc("S004953511", "D09530004VXE0D4");
export const __12_emitter_dom_br: Codes = pc("S006953400", "D09530006VXE0B0");
export const __38_emitter_dom_ss: Codes = pc("S003953X02", "D09530003VXESFF");
export const __38_emitter_dom_es: Codes = pc("S003953032", "D09530003VXE0DF");
export const __14_emitter_dom_ss: Codes = pc("S002953X4F", "D09530002VXESDF");
export const __14_emitter_cav_sp: Codes = pc("S003953170", "D09530002VXCVE0");
export const __14_emitter_dom_es: Codes = pc("S002953X2E", "D09530002VXEEDF");
export const __18_emitter_dom_ss: Codes = pc("S00195310X", "D09530000VXE0TX");
export const __18_emitter_cav_sp: Codes = pc("S003953105", "D09530000VXE0NM");

// flow cartridges
export const __flow_cartridge_13: Codes = pc("K000953X13", "D09530006VXWCX3");
export const __flow_cartridge_26: Codes = pc("K000953X26", "D09530006VXWCX4");
export const __flow_cartridge_53: Codes = pc("K000953X53", "D09530006VXWCX5");
export const __flow_cartridge_79: Codes = pc("K000953X79", "D09530006VXWCX7");
export const __flow_cartridge_106: Codes = pc("K000953X06", "D09530006VXWCX6");
export const __flow_cartridge_159: Codes = pc("K00095315X", "K09530006VXWCX9");
export const __flow_cartridge_211: Codes = pc("K000953X11", "K09530006VXWCX1");
export const __flow_cartridge_423: Codes = pc("K000953X23", "K09530006VXWCX3");

export const __tamper_resistance_kit: Codes = pc(
  "K000950WTR",
  "K09500000VXWTRR"
);

// add-ons
export const __adapter_straight: Codes = pc("PAY7000C01", "D09550002VXMFBA");
export const __braided_hose_36: Codes = pc("P360955228", "D09550360VXJICX");
export const __adapter_elbow: Codes = pc("PAY0955001", "D09550000VXBSEN");

// cylinder racks
export const __cylinder_rack_1_2: Codes = pc("K800950002", "D09500000VX8WM8");
export const __cylinder_rack_1_4: Codes = pc("K800950004", "D09500000VX8WM2");
export const __cylinder_rack_5_8: Codes = pc("K800950008", "D09500000VX8WM4");
export const __cylinder_rack_9_12: Codes = pc("K800950012", "D09500000VX8WM1");

// manifold options
export const __manifold_2x1: Codes = pc("S00M950PM2", "D09500000VXSM20");
export const __manifold_3x1: Codes = pc("S00M950PM3", "D09500000VX0M30");
export const __manifold_4x1: Codes = pc("S00M950PM4", "D09500000VXSM40");
export const __manifold_6x1: Codes = pc("S00M950PM6", "D09500000VXSM60");
export const __manifold_2x2: Codes = pc("S00M950PP4", "D09500000VXSM42");
export const __manifold_3x2: Codes = pc("S00M950PP6", "D09500000VXSM63");
export const __manifold_4x2: Codes = pc("S00M950PP8", "D09500000VXSM84");
export const __manifold_6x2: Codes = pc("S00M95PP12", "D09500000VXSM16");

// manifold plugs
export const __manifold_plug: Codes = pc("P006000Z07", "P00000006NPTV00");

// nitrogen relief valve
export const __n2_relief_valve: Codes = pc("S010951RLV", "D09510014VXR000");

// rack hoses
export const __x2_rack_hose: Codes = pc("S000950P70", "D09500004VXSPH0");
export const __adj_rack_hose: Codes = pc("S000950P50", "D09500002VXPH00");

// water tank
export const __tank_10gal: Codes = pc("S100950140", "D09500010VXWTW0");
export const __tank_30gal: Codes = pc("S300950140", "D09500030VXWTW0");
export const __tank_60gal: Codes = pc("S600950140", "D09500060VXWTW0");
export const __tank_80gal: Codes = pc("S800950140", "D09500080VXWTW0");
export const __tank_120gal: Codes = pc("S120950140", "D09501200VXWTW0");
export const __tank_200gal: Codes = pc("S200950140", "D09502000VXWTW0");
export const __tank_400gal: Codes = pc("S400950140", "D09504000VXWTW0");
export const __tank_10gal_afc: Codes = pc("S10095014C", "D09500010VXWTRC");
export const __tank_30gal_afc: Codes = pc("S300950141", "D09500030VXWTWC");
// eu water tanks
export const __tank_100lit: Codes = pc("D09500000VXWTX1", "D09500000VXWTX1");
export const __tank_150lit: Codes = pc("D09500000VXWTXS", "D09500000VXWTXS");
export const __tank_300lit: Codes = pc("D09500000VXWTX3", "D09500000VXWTX3");
export const __tank_500lit: Codes = pc("S000950X50", "D09500000VXWTX5");
export const __tank_750lit: Codes = pc("D09500000VXWTX7", "D09500000VXWTX7");
export const __tank_1000lit: Codes = pc("D09500000VXWTXA", "D09500000VXWTXA");

// batteries
export const __backup_bat_115: Codes = pc("S000950027", "D09500000VX0BDC");
export const __backup_bat_220: Codes = pc("S000950220", "D09500220VX0BDC");

// tank regulators
export const __tank_regulator_nor: Codes = pc("P000950065", "D09500002VX00RM");
export const __tank_regulator_hc: Codes = pc("S000950HCW", "D09500004VXHAWT");

// cylinders
export const __80L_cylinder_n2: Codes = pc("S000950A01", "D09500000VXS000");
export const __49L_cylinder_n2: Codes = pc("S000950A02", "D09500000VXSC0A");
export const __80L_cylinder_n2_unfilled: Codes = pc(
  "S000950E01",
  "D09500000VX8CE0"
);

// panel options
export const __panel1_1500ar: Codes = pc("S010951ACT", "D09510010VX3ARC");
export const __panel15_1500ar: Codes = pc("S014951ACT", "D09510014VX3ARC");
export const __panel1_1500dc: Codes = pc("S010951DRY", "D09510010VX3DC1");
export const __panel15_1500dc: Codes = pc("S014951DRY", "D09510014VX3DCC");
export const __panel1_fdc: Codes = pc("S010951F00", "D09510010VX3DC2");
export const __panel15_fdc: Codes = pc("S014951F00", "D09510014VX3DCF");
export const __panel1_far: Codes = pc("S010951FA0", "D09510010VX3ARF");
export const __panel15_far: Codes = pc("S014951FA0", "D09510014VX3ARF");
export const __panel15_zdc: Codes = pc("S014951F00", "D09510014VX3DCF");
export const __panel2_zdc: Codes = pc("S02095110A", "D09510020VX3DCZ");

export const __threaded_ball_valve: Codes = pc("V010728CT0", "V07280010DP3B00");
export const __12_low_pressure_n2_switch: Codes = pc(
  "S000760044",
  "D07600000EASPSD"
);

// manifold assemblies
export const __manifold_1assembly: Codes = pc("S000950010", "D09500010VX0MIB");
export const __manifold_15assembly: Codes = pc("S014950121", "D09500014VXKMIB");

// pre-engineered cylinder subassemblies
export const __pre_1cyl: Codes = pc("S800950001", "D09500010VXCY00");
export const __pre_2cyl: Codes = pc("S800950002", "D09500020VXCY00");
export const __pre_3cyl: Codes = pc("S800950003", "D09500030VXCY00");
export const __pre_4cyl: Codes = pc("S800950004", "D09500040VXCY00");
export const __pre_5cyl: Codes = pc("S800950005", "D09500050VXCY00");
export const __pre_6cyl: Codes = pc("S800950006", "D09500060VXCY00");
export const __pre_7cyl: Codes = pc("S800950007", "D09500070VXCY00");
export const __pre_8cyl: Codes = pc("S800950008", "D09500080VXCY00");

// manuals
export const __eng_iom_manual: Codes = pc("Z000VTX00M", "ZM2014700000000");
export const __preeng_iom_manual: Codes = pc("Z000VTXPES", "ZM2036200000000");
