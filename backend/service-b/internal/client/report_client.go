package client

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/fs-assignment/service-b/internal/constants"
	pb "github.com/fs-assignment/service-b/proto"
)

type ReportClient struct {
	client pb.ReportServiceClient
	conn   *grpc.ClientConn
}

func NewReportClient(addr string) (*ReportClient, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &ReportClient{client: pb.NewReportServiceClient(conn), conn: conn}, nil
}

func (c *ReportClient) Close() error {
	return c.conn.Close()
}

func (c *ReportClient) GeneratePdf(ctx context.Context, filterDate, filterType string, timeSeriesJSON []byte) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, constants.GRPCDeadline)
	defer cancel()

	resp, err := c.client.GeneratePdf(ctx, &pb.ReportRequest{
		FilterDate:     filterDate,
		FilterType:     filterType,
		TimeSeriesJson: timeSeriesJSON,
	})
	if err != nil {
		return nil, err
	}
	return resp.PdfContent, nil
}
