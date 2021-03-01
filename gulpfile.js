const gulp = require('gulp');
const postcss = require('gulp-postcss');
const postcss_plugins = {
	nested: require('postcss-nested'),
};
const rename = require('gulp-rename');
const inline_source = require('gulp-inline-source-html');
const htmlmin = require('gulp-htmlmin');
const brotli = require('gulp-brotli');
const rollup = require('rollup');
const rollup_plugins = {
	commonjs: require('@rollup/plugin-commonjs'),
	nodeResolve: require('@rollup/plugin-node-resolve').default,
	jsonResolve: require('@rollup/plugin-json'),
	typescript: require('@rollup/plugin-typescript'),
	terser: require('rollup-plugin-terser').default,
};
const { terser } = require('rollup-plugin-terser');
const replace = require('gulp-replace');
const {
	readFileSync,
	copyFileSync,
} = require('fs');

gulp.task('typescript', async () => {
	const bundle = await rollup.rollup({
		input: './src/js/index.ts',
		plugins: [
			rollup_plugins.commonjs(),
			rollup_plugins.nodeResolve(),
			rollup_plugins.jsonResolve(),
			rollup_plugins.typescript({
				tsconfig: './tsconfig.json',
				outDir: './src/js',
			}),
			terser({
			}),
		],
	});

	return await bundle.write({
		sourcemap: false,
		format: 'es',
		dir: './src/js/',
	});
});

gulp.task('postcss', () => {
	return gulp.src('./src/**/*.postcss').pipe(
		postcss([
			postcss_plugins.nested(),
		])
	).pipe(
		rename({
			extname: '.css'
		})
	).pipe(gulp.dest('./src/'));
});

gulp.task('build', () => {
	const js = readFileSync('./src/js/index.js');

	return gulp.src('./src/index.html').pipe(
		inline_source()
	).pipe(
		replace(
			'<script src="./js/index.js" async defer></script>',
			`<script async defer>${js}</script>`
		)
	).pipe(
		htmlmin({
			collapseInlineTagWhitespace: false,
			collapseWhitespace: true,
			minifyCSS: true,
			minifyJs: false,
			removeAttributeQuotes: true,
			preserveLineBreaks: false,
			removeComments: true,
			useShortDoctype: true,
		})
	).pipe(gulp.dest('./subtitle-editor/'));
});

gulp.task('compress', () => {
	return gulp.src(
		'./subtitle-editor/{index.html,schema.json}'
	).pipe(
		brotli.compress({
			quality: 11,
		})
	).pipe(
		gulp.dest('./subtitle-editor/')
	);
});

gulp.task('copyschema', (cb) => {
	copyFileSync('./src/schema.json', './subtitle-editor/schema.json');

	return cb();
});

gulp.task('default', gulp.series(...[
	gulp.parallel(...[
		'typescript',
		'postcss',
		'copyschema',
	]),
	'build',
	'compress',
]));
