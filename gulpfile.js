const gulp = require('gulp');
const typescript = require('gulp-typescript');

gulp.task('typescript', () => {
    return gulp.src('./src/**/*.ts').pipe(
        typescript.createProject(
            './tsconfig.json'
        )()
    ).pipe(gulp.dest('./src/'));
});
