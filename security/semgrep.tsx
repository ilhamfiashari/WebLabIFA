// ruleid: lab-no-raw-html
const unsafeHtml = <div dangerouslySetInnerHTML={{ __html: payload }} />
// ok: lab-no-raw-html
const safeHtml = <pre>{payload}</pre>
