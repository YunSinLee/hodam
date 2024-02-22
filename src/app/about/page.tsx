import { Metadata } from "next";
import Head from "next/head";

export const metadata: Metadata = {
  title: "About",
};

export default function About() {
  return (
    <div>
      <Head>
        <title>About | Next Movies</title>
      </Head>
      <h1>about</h1>
    </div>
  );
}
