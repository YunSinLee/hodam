import MovieInfo from "@/app/components/movie/movie-info";
import MovieVideos from "@/app/components/movie/movie-videos";
import { Suspense } from "react";
import { API_URL } from "@/app/(my)/my/page";

interface Params {
  id: string;
}

const getMovie = async (id: string) => {
  const response = await fetch(`https://${API_URL}/${id}`);
  const json = await response.json();
  return json;
};

export async function generateMetadata({ params: { id } }: { params: Params }) {
  const movie = await getMovie(id);
  return {
    title: movie.title,
    description: "영화 상세 페이지입니다.",
  };
}

export default async function Result({ params: { id } }: { params: Params }) {
  return (
    <div>
      <Suspense fallback={<h1>영화 로딩중</h1>}>
        <MovieInfo id={id} />
      </Suspense>
      <Suspense fallback={<h1>영상 로딩중</h1>}>
        <MovieVideos id={id} />
      </Suspense>
    </div>
  );
}
