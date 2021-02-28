const gulp = require('gulp');
const typescript = require('gulp-typescript');
const postcss = require('gulp-postcss');
const postcss_plugins = {
    nested: require('postcss-nested'),
};
const rename = require('gulp-rename');

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

gulp.task('default', gulp.series(...[
    gulp.parallel(...[
        'typescript',
        'postcss',
    ]),
]));
