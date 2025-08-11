import { useState } from "react";
import { useSubtitleDownload, useSubtitleSearch } from "../../hooks/useSubtitles";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function SubtitleSearchExample() {
  const { searchResults, searchSubtitles, loading, error } = useSubtitleSearch();
  const { downloadSubtitle, downloading } = useSubtitleDownload();

  const [searchParams, setSearchParams] = useState({
    query: "",
    imdb_id: "",
    languages: "en",
    type: "all" as const,
  });

  const handleSearch = async () => {
    const params: any = {
      languages: searchParams.languages,
      type: searchParams.type,
    };

    if (searchParams.query) {
      params.query = searchParams.query;
    }

    if (searchParams.imdb_id) {
      params.imdb_id = parseInt(searchParams.imdb_id);
    }

    await searchSubtitles(params);
  };

  const handleDownload = async (fileId: number) => {
    const content = await downloadSubtitle(fileId.toString());
    if (content) {
      // Create a blob and download the subtitle file
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subtitle_${fileId}.srt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h2 className="mb-6 text-2xl font-bold">Subtitle Search</h2>

      {/* Search Form */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="query">Search Query</Label>
            <Input
              id="query"
              value={searchParams.query}
              onChange={(e) =>
                setSearchParams((prev) => ({ ...prev, query: e.target.value }))
              }
              placeholder="e.g., The Matrix"
            />
          </div>

          <div>
            <Label htmlFor="imdb_id">IMDB ID (optional)</Label>
            <Input
              id="imdb_id"
              value={searchParams.imdb_id}
              onChange={(e) =>
                setSearchParams((prev) => ({ ...prev, imdb_id: e.target.value }))
              }
              placeholder="e.g., 133093"
            />
          </div>

          <div>
            <Label htmlFor="languages">Languages</Label>
            <Input
              id="languages"
              value={searchParams.languages}
              onChange={(e) =>
                setSearchParams((prev) => ({ ...prev, languages: e.target.value }))
              }
              placeholder="e.g., en,es,fr"
            />
          </div>

          <div>
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={searchParams.type}
              onChange={(e) =>
                setSearchParams((prev) => ({ ...prev, type: e.target.value as any }))
              }
              className="w-full rounded-md border p-2"
            >
              <option value="all">All</option>
              <option value="movie">Movie</option>
              <option value="episode">Episode</option>
            </select>
          </div>
        </div>

        <Button
          onClick={handleSearch}
          disabled={loading || (!searchParams.query && !searchParams.imdb_id)}
          className="w-full"
        >
          {loading ? "Searching..." : "Search Subtitles"}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div className="rounded-lg bg-white shadow">
          <div className="border-b p-4">
            <h3 className="text-lg font-semibold">
              Search Results ({searchResults.total_count} total)
            </h3>
            <p className="text-sm text-gray-600">
              Page {searchResults.page} of {searchResults.total_pages}
            </p>
          </div>

          <div className="divide-y">
            {searchResults.data.map((subtitle) => (
              <div key={subtitle.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-lg font-medium">
                      {subtitle.attributes.feature_details.title} (
                      {subtitle.attributes.feature_details.year})
                    </h4>
                    <p className="mb-2 text-sm text-gray-600">
                      Language: {subtitle.attributes.language} | Downloads:{" "}
                      {subtitle.attributes.download_count} | Rating:{" "}
                      {subtitle.attributes.ratings}/10
                    </p>
                    <p className="text-sm text-gray-500">
                      Release: {subtitle.attributes.release}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {subtitle.attributes.hd && (
                        <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                          HD
                        </span>
                      )}
                      {subtitle.attributes.hearing_impaired && (
                        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                          HI
                        </span>
                      )}
                      {subtitle.attributes.ai_translated && (
                        <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-800">
                          AI
                        </span>
                      )}
                      {subtitle.attributes.from_trusted && (
                        <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">
                          Trusted
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    {subtitle.attributes.files[0] && (
                      <Button
                        onClick={() =>
                          handleDownload(subtitle.attributes.files[0].file_id)
                        }
                        disabled={downloading}
                        size="sm"
                      >
                        {downloading ? "Downloading..." : "Download"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
