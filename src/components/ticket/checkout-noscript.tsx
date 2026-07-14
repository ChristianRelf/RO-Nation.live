/**
 * What a visitor with no JavaScript used to get on the checkout page: the backdrop, saying
 * "Completing your order", forever. No spinner, no error, no way out - the reservation is
 * fired by the modal's effect, so without JS it simply never happens, and nothing on the
 * page ever said so. You would sit there watching a heading until you gave up.
 *
 * Every other step of this flow works without JavaScript on purpose. The reserve step is a
 * plain GET form, precisely so a JS-less browser and the back button both behave (see
 * checkout-form.tsx). Checkout is the one page that genuinely cannot, because the order is
 * placed from the client - and the honest thing is to say so.
 *
 * The load-bearing sentence is "nothing was reserved". It is also true: the action is never
 * called, so there is no half-placed order to worry about, and that is the only question a
 * person in this state actually has.
 *
 * Shared by RNL's checkout and every partner's, because they are the same page - and two
 * copies of an apology are two copies that drift.
 */
export function CheckoutNoScript({ reserveHref }: { reserveHref: string }) {
  return (
    <noscript>
      {/* Above the modal's z-[60]: if JS is off, the modal is not there to be covered, but
          if JS merely FAILED - a chunk that would not load, an extension that broke
          hydration - this is what should win. */}
      <div className="fixed inset-0 z-[70] grid place-items-center bg-bg p-6">
        <div className="card w-full max-w-md p-8 text-center">
          <p className="kicker text-red-400">JavaScript needed</p>
          <h2 className="display mt-4 text-3xl">
            We can&apos;t finish this step here
          </h2>
          <p className="mt-3 text-sm text-muted">
            The last step of checkout runs in your browser, so it needs JavaScript
            switched on. <strong className="text-fg">Nothing was reserved</strong> and
            you haven&apos;t lost your place - turn it on and start again.
          </p>
          <a href={reserveHref} className="btn btn-accent mt-7 w-full">
            Back to checkout
          </a>
        </div>
      </div>
    </noscript>
  );
}
