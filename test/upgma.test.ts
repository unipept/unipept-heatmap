import UPGMAClusterer from "../src/cluster/UPGMAClusterer";
import EuclidianDistanceMetric from "../src/metric/euclidianDistanceMetric";
import ClusterElement from "../src/cluster/clusterElement";
import TestDataGenerator from "./testDataGenerator";
import TreeNode from "../src/cluster/treeNode";
import Utils from "./utils";

/**
 * The topology of the output dendrogram was created by hand, and needs to match the one calculated by the
 * UPGMAClusterer.
 */
let getExpectedSmallDendrogram = function() {
    // First create the leaf nodes
    let a: TreeNode<number[]> = new TreeNode<number[]>(null, null, [], 0);
    let b: TreeNode<number[]> = new TreeNode<number[]>(null, null, [], 0);
    let c: TreeNode<number[]> = new TreeNode<number[]>(null, null, [], 0);
    let d: TreeNode<number[]> = new TreeNode<number[]>(null, null, [], 0);
    let e: TreeNode<number[]> = new TreeNode<number[]>(null, null, [], 0);

    // Now connect all leafs as they were merged
    let ab: TreeNode<number[]> = new TreeNode<number[]>(b, a, [], 0.1);
    let ed: TreeNode<number[]> = new TreeNode<number[]>(e, d, [], 0.25);
    let cba: TreeNode<number[]> = new TreeNode<number[]>(c, ab, [], 0.77);
    let root: TreeNode<number[]> = new TreeNode<number[]>(ed, cba, [], 1.036);

    return root;
};

let getExpectedLargeDendrogram = function() {

};

it('should produce dendrograms with correct topology', () => {
    let dataGenerator = new TestDataGenerator();
    let originalData: number[][] = dataGenerator.getSmall2DDataSet();
    let data: ClusterElement<number>[][] = originalData.map((row: number[]) => row.map((el: number) => new ClusterElement<number>(el, 0)));
    let clusterer = new UPGMAClusterer<number>(new EuclidianDistanceMetric());

    let actualDendroRoot: TreeNode<number[]> = clusterer.cluster(data, "rows");
    let expectedDendroRoot: TreeNode<number[]> = getExpectedSmallDendrogram();

    Utils.compareDendrograms(actualDendroRoot, expectedDendroRoot);
});

