package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"

	"github.com/fs-assignment/service-bonus/internal/pdfgen"
	pb "github.com/fs-assignment/service-bonus/proto"
	"google.golang.org/grpc"
)

type reportServer struct {
	pb.UnimplementedReportServiceServer
	generator *pdfgen.Generator
}

func (s *reportServer) GeneratePdf(_ context.Context, req *pb.ReportRequest) (*pb.ReportResponse, error) {
	pdf, err := s.generator.Generate(req.FilterDate, req.FilterType, req.TimeSeriesJson)
	if err != nil {
		return nil, err
	}
	return &pb.ReportResponse{PdfContent: pdf}, nil
}

func main() {
	port := os.Getenv("GRPC_PORT")
	if port == "" {
		port = "50051"
	}

	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("listen: %v", err)
	}

	server := grpc.NewServer()
	pb.RegisterReportServiceServer(server, &reportServer{generator: pdfgen.NewGenerator()})

	log.Printf("Report gRPC service listening on :%s", port)
	if err := server.Serve(lis); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
