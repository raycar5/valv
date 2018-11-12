import filesize from 'rollup-plugin-filesize';
import { terser } from 'rollup-plugin-terser';
import nodeResolve from 'rollup-plugin-node-resolve';
import { plugin as analyze } from 'rollup-plugin-analyzer';

export default {
  input: 'valv.js',
  output: {
    file: 'valv.bundled.js',
    format: 'esm'
    //name: 'valv'
  },
  plugins: [
    analyze({ limit: 10 }),
    nodeResolve({
      // use "jsnext:main" if possible
      // see https://github.com/rollup/rollup/wiki/jsnext:main
      jsnext: true
    }),
    terser({
      warnings: true,
      mangle: {
        module: true
      }
    }),
    filesize({
      showBrotliSize: true
    })
  ]
};
