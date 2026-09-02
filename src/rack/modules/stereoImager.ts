import type { ParamValues, RackModuleDef, RackNode } from '../types';

/** Mid/side width control. width 1 = unchanged, 0 = mono, 2 = extra wide. */
export const stereoImagerModule: RackModuleDef = {
  type: 'fx.imager',
  kind: 'insert',
  label: 'Stereo Imager',
  family: 'Stereo',
  params: [{ key: 'width', label: 'Width', type: 'float', min: 0, max: 2, step: 0.01, default: 1 }],
  createNode(ctx: BaseAudioContext, params: ParamValues): RackNode {
    const input = ctx.createGain();
    const output = ctx.createGain();
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);

    // mid = 0.5L + 0.5R
    const midL = ctx.createGain();
    const midR = ctx.createGain();
    midL.gain.value = 0.5;
    midR.gain.value = 0.5;
    const mid = ctx.createGain();

    // side = 0.5L - 0.5R
    const sideL = ctx.createGain();
    const sideR = ctx.createGain();
    sideL.gain.value = 0.5;
    sideR.gain.value = -0.5;
    const side = ctx.createGain();

    const sidePos = ctx.createGain(); // +side * width -> left
    const sideNeg = ctx.createGain(); // -side * width -> right

    input.connect(splitter);
    splitter.connect(midL, 0);
    splitter.connect(midR, 1);
    midL.connect(mid);
    midR.connect(mid);
    splitter.connect(sideL, 0);
    splitter.connect(sideR, 1);
    sideL.connect(side);
    sideR.connect(side);
    side.connect(sidePos);
    side.connect(sideNeg);

    mid.connect(merger, 0, 0);
    sidePos.connect(merger, 0, 0);
    mid.connect(merger, 0, 1);
    sideNeg.connect(merger, 0, 1);
    merger.connect(output);

    const apply = (p: ParamValues) => {
      const w = p.width as number;
      sidePos.gain.value = w;
      sideNeg.gain.value = -w;
    };
    apply(params);

    return {
      input,
      output,
      update: apply,
      dispose: () => {
        for (const n of [input, output, splitter, merger, midL, midR, mid, sideL, sideR, side, sidePos, sideNeg]) {
          try {
            n.disconnect();
          } catch {
            /* noop */
          }
        }
      },
    };
  },
};
