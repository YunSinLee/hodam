import { Metadata } from "next";
import Head from "next/head";

import { supabase } from "../utils/supabase";

async function getKeywords() {
  const { data } = await supabase
    .from("keywords")
    .insert([{ id: 2, thread_id: "soadifajsdof", keyword: "윤신윤신" }])
    .select();

  let { data: keywords, error } = await supabase.from("keywords").select("*");

  if (error) {
    throw error;
  }
  return keywords;
}

export const metadata: Metadata = {
  title: "About",
};

export default function About() {
  getKeywords();
  return (
    <div>
      <Head>
        <title>About | Next Movies</title>
      </Head>
      <h1>about</h1>
    </div>
  );
}
