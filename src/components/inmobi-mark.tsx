/**
 * The InMobi lockup, straight from the official asset.
 *
 * Paths are verbatim from
 * https://web.inmobicdn.net/website/website/6.0.1/inmobi-main-images/InMobi-logo.svg
 * — not redrawn — so the letterforms and the loop are exact. Only the colour is
 * dropped: the brand mark is a four-stop gradient and a struck medal is one
 * metal, so everything fills with `currentColor` and the caller sets the tone.
 *
 * Only the loop is kept here: it is the "o" of the word and doubles as the
 * standalone mark, which is all the medal needs — the name beside it is set
 * in the site's own display face. The five letterforms are in the same source
 * file at the URL above if the full lockup is ever wanted.
 *
 * Coordinates stay in the logo's own space. Measured with `getBBox()`, not
 * estimated: the loop sits at x 67.223, y 0.5, 25.25 wide and 18 tall.
 */
/** The loop — the "o", and the standalone mark. */
export function InMobiLoopShapes() {
  return (
    <g fill="currentColor" stroke="none" fillRule="evenodd">
      <path d="M67.2771 8.02265C68.8706 5.3812 71.73 3.76724 74.8144 3.76724C75.6524 3.76724 84.9077 3.77224 85.0442 3.77224C86.2537 3.77224 87.1602 4.05973 87.8022 4.56172C87.8237 4.57872 87.8517 4.55522 87.8387 4.53122C86.7082 2.46276 84.6537 0.518305 82.1718 0.500305C82.1648 0.500305 74.5694 0.505805 74.5694 0.505805C69.965 0.573804 67.3461 3.48374 67.2231 8.00615C67.2226 8.03615 67.2616 8.04815 67.2771 8.02265Z" />
      <path d="M92.473 9.51161C92.473 2.49826 88.7181 0.209808 84.3857 0.528802C84.3602 0.530802 84.3537 0.564801 84.3762 0.576301C86.9592 1.87377 89.2191 4.44022 89.2191 9.50011C89.2191 14.4285 87.3711 16.937 84.5282 18.4459C84.5062 18.4579 84.5122 18.4894 84.5372 18.4909C85.1062 18.5244 92.473 18.8449 92.473 9.51161Z" />
      <path d="M84.7457 17.9014C86.1092 17.0975 87.3422 15.874 87.9476 14.426C87.9576 14.402 87.9291 14.381 87.9091 14.3975C87.7481 14.5295 87.1132 15.228 84.2907 15.228C81.0038 15.228 74.9179 15.228 74.6839 15.228C71.781 15.228 70.5465 13.774 70.5465 9.51511C70.5465 6.19568 71.273 5.2547 71.558 4.95021C71.5785 4.92721 71.5515 4.89071 71.524 4.90371C70.1245 5.5177 68.918 6.50068 68.0331 7.74715C66.5801 9.72961 67.1401 14.1015 69.2425 16.3785C70.6335 17.8584 72.718 18.5169 74.6349 18.4954L82.4328 18.4999C83.2427 18.5044 84.0397 18.2979 84.7457 17.9014Z" />
    </g>
  );
}
