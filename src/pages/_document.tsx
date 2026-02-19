import { Html, Head, Main, NextScript } from "next/document";

const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
@font-face {
  font-family: "trade_gothicBdCnno.20";
  src: url("${bp}/fonts/trade_gothic_bold_condensed_no._20-webfont.woff2") format("woff2"),
       url("${bp}/fonts/trade_gothic_bold_condensed_no._20-webfont.woff") format("woff");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "trade_gothic_lt_stdlight";
  src: url("${bp}/fonts/trade_gothic_lt_std_light-webfont.woff2") format("woff2"),
       url("${bp}/fonts/trade_gothic_lt_std_light-webfont.woff") format("woff");
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "trade_gothicmedium";
  src: url("${bp}/fonts/trade_gothic_medium-webfont.woff2") format("woff2"),
       url("${bp}/fonts/trade_gothic_medium-webfont.woff") format("woff");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Forza";
  src: url("${bp}/fonts/Forza-Book.woff2") format("woff2"),
       url("${bp}/fonts/Forza-Book.woff") format("woff");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Forza";
  src: url("${bp}/fonts/Forza-Bold.woff2") format("woff2"),
       url("${bp}/fonts/Forza-Bold.woff") format("woff");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
`,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
