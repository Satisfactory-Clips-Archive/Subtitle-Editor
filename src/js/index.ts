const templates:{[key:string]:HTMLTemplateElement} = {};
const main = document.body.querySelector('main') as HTMLElement;

(
    [...document.head.querySelectorAll(
        'template[id]'
    )] as HTMLTemplateElement[]
).forEach((e) => {
    templates[e.id] = e;
});

function clone_template(id:string) : DocumentFragment
{
    if ( ! (id in templates)) {
        throw new Error(
            `Argument 1 passed to clone_template() was not a supported id (${
                id
            })`
        );
    }

    return templates[id].content.cloneNode(true) as DocumentFragment;
}

function load_await_url() : void
{
    const await_url = clone_template('submit-url');
    const url = await_url.querySelector('input');
    const regex = /^(?:https?:\/\/(?:www\.)?)?(?:youtu\.be\/(?<youtubeid>[a-zA-Z0-9_\-]{11}))/;

    if ( ! url) {
        throw new Error('Could not find URL input!');
    }

    url.setAttribute('pattern', regex.toString().substr(1).replace(/\/$/, ''));

    main.textContent = '';
    main.appendChild(await_url);
}

load_await_url();
