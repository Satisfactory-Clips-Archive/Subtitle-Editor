const gulp = require('gulp');
const typescript = require('gulp-typescript');
const postcss = require('gulp-postcss');
const postcss_plugins = {
	nested: require('postcss-nested'),
};
const rename = require('gulp-rename');
const inline_source = require('gulp-inline-source-html');
const htmlmin = require('gulp-htmlmin');

gulp.task('typescript', () => {
	return gulp.src('./src/**/*.ts').pipe(
		typescript.createProject(
			'./tsconfig.json'
		)()
	).pipe(gulp.dest('./src/'));
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
	return gulp.src('./src/index.html').pipe(
		inline_source()
	).pipe(
		htmlmin({
			collapseInlineTagWhitespace: false,
			collapseWhitespace: true,
			minifyCSS: true,
			minifyJs: true,
			removeAttributeQuotes: true,
			preserveLineBreaks: false,
			removeComments: true,
			useShortDoctype: true,
		})
	).pipe(gulp.dest('./subtitle-editor/'));
});

gulp.task('default', gulp.series(...[
	gulp.parallel(...[
		'typescript',
		'postcss',
	]),
	'build',
]));
