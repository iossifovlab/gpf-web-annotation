# pylint: disable=W0621,C0114,C0116,W0212,W0613
from django.test import Client
import pytest


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
@pytest.mark.parametrize(
    "type_filter,search_term,expected",
    [
        (None, None, [
            "hg38/GRCh38-hg38/genome",
            "scores/pos1",
            "scores/pos2",
            "t4c8/gene_scores/t4c8_score",
            "t4c8/gene_sets/main",
            "t4c8/genomic_scores/score_one",
            "t4c8/t4c8_genes",
            "t4c8/t4c8_genome",
        ]),
        ("genome", None, [
            "hg38/GRCh38-hg38/genome",
            "t4c8/t4c8_genome",
        ]),
        ("gene_set_collection", None, [
            "t4c8/gene_sets/main",
        ]),
        ("position_score", None, [
            "scores/pos1",
            "scores/pos2",
            "t4c8/genomic_scores/score_one",
        ]),
        ("position_score", "score_one", [
            "t4c8/genomic_scores/score_one",
        ]),
        (None, "score_one", [
            "t4c8/genomic_scores/score_one",
        ]),
        (None, "t4c8", [
            "t4c8/gene_scores/t4c8_score",
            "t4c8/gene_sets/main",
            "t4c8/genomic_scores/score_one",
            "t4c8/t4c8_genes",
            "t4c8/t4c8_genome",
        ]),
    ],
)
def test_get_resources(
    current_client: str, clients: dict[str, Client],
    type_filter: str | None,
    search_term: str | None,
    expected: list[str],
) -> None:
    expected_resources = set(expected)

    client = clients[current_client]

    query_params = {}
    if type_filter:
        query_params["type"] = type_filter
    if search_term:
        query_params["search"] = search_term

    response = client.get("/api/resources", query_params=query_params)

    assert response.status_code == 200
    assert set(response.json()) == expected_resources


@pytest.mark.parametrize("current_client", ["admin", "user", "anonymous"])
def test_get_resource_types(
    current_client: str, clients: dict[str, Client],
) -> None:
    client = clients[current_client]

    response = client.get("/api/resources/types")

    assert response.status_code == 200
    assert set(response.json()) == {
        "genome",
        "gene_models",
        "liftover_chain",
        "gene_set_collection",
        "position_score",
        "allele_score",
        "gene_score",
    }
